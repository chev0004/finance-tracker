import { createHash, randomBytes } from 'node:crypto';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { and, eq, sql } from 'drizzle-orm';
import { mcpOAuthClient, mcpOAuthCode, mcpOAuthToken } from '@/db/schema';
import { db } from '@/lib/db';

export const TRACKER_SCOPES = ['tracker:read', 'tracker:write'];

let oauthTablesPromise: Promise<void> | undefined;

const ensureOAuthTables = () => {
  oauthTablesPromise ??= (async () => {
    await db.run(sql`CREATE TABLE IF NOT EXISTS mcp_oauth_client (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      redirect_uris TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
    )`);
    await db.run(sql`CREATE TABLE IF NOT EXISTS mcp_oauth_code (
      hash TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES mcp_oauth_client(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      redirect_uri TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      scopes TEXT NOT NULL,
      resource TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`);
    await db.run(sql`CREATE TABLE IF NOT EXISTS mcp_oauth_token (
      hash TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      client_id TEXT NOT NULL REFERENCES mcp_oauth_client(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      scopes TEXT NOT NULL,
      resource TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`);
  })();
  return oauthTablesPromise;
};

const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const secret = (prefix: string) =>
  `${prefix}_${randomBytes(36).toString('base64url')}`;

export const getPublicOrigin = (request: Request) =>
  (process.env.BETTER_AUTH_URL ?? new URL(request.url).origin).replace(
    /\/$/,
    '',
  );

export const getMcpResource = (request: Request) =>
  `${getPublicOrigin(request)}/api/mcp`;

export const getResourceMetadataUrl = (request: Request) =>
  `${getPublicOrigin(request)}/.well-known/oauth-protected-resource`;

export const parseScopes = (value: string | null) => {
  const scopes = [...new Set((value || TRACKER_SCOPES.join(' ')).split(/\s+/))];
  return scopes.every((scope) => TRACKER_SCOPES.includes(scope))
    ? scopes
    : null;
};

export async function registerOAuthClient(
  name: string,
  redirectUris: string[],
) {
  await ensureOAuthTables();
  const client = {
    id: secret('client'),
    name,
    redirectUris,
  };
  await db.insert(mcpOAuthClient).values({
    id: client.id,
    name: client.name,
    redirectUris: JSON.stringify(client.redirectUris),
  });
  return client;
}

export async function getOAuthClient(id: string) {
  await ensureOAuthTables();
  const rows = await db
    .select()
    .from(mcpOAuthClient)
    .where(eq(mcpOAuthClient.id, id))
    .limit(1);
  const row = rows[0];
  return row
    ? {
        id: row.id,
        name: row.name,
        redirectUris: JSON.parse(row.redirectUris) as string[],
      }
    : null;
}

export async function createAuthorizationCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: string;
}) {
  await ensureOAuthTables();
  const code = secret('code');
  await db.insert(mcpOAuthCode).values({
    hash: hash(code),
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    scopes: input.scopes.join(' '),
    resource: input.resource,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });
  return code;
}

async function issueTokens(input: {
  clientId: string;
  userId: string;
  scopes: string;
  resource: string;
}) {
  const accessToken = secret('access');
  const refreshToken = secret('refresh');
  await db.insert(mcpOAuthToken).values([
    {
      hash: hash(accessToken),
      kind: 'access',
      clientId: input.clientId,
      userId: input.userId,
      scopes: input.scopes,
      resource: input.resource,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
    {
      hash: hash(refreshToken),
      kind: 'refresh',
      clientId: input.clientId,
      userId: input.userId,
      scopes: input.scopes,
      resource: input.resource,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  ]);
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: refreshToken,
    scope: input.scopes,
  };
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  resource: string;
}) {
  await ensureOAuthTables();
  const codeHash = hash(input.code);
  const rows = await db
    .select()
    .from(mcpOAuthCode)
    .where(eq(mcpOAuthCode.hash, codeHash))
    .limit(1);
  const row = rows[0];
  if (
    !row ||
    row.expiresAt < new Date() ||
    row.clientId !== input.clientId ||
    row.redirectUri !== input.redirectUri ||
    row.resource !== input.resource ||
    createHash('sha256').update(input.codeVerifier).digest('base64url') !==
      row.codeChallenge
  ) {
    return null;
  }
  await db.delete(mcpOAuthCode).where(eq(mcpOAuthCode.hash, codeHash));
  return issueTokens({
    clientId: row.clientId,
    userId: row.userId,
    scopes: row.scopes,
    resource: row.resource,
  });
}

export async function exchangeRefreshToken(
  refreshToken: string,
  clientId: string,
  resource: string,
) {
  await ensureOAuthTables();
  const tokenHash = hash(refreshToken);
  const rows = await db
    .select()
    .from(mcpOAuthToken)
    .where(
      and(eq(mcpOAuthToken.hash, tokenHash), eq(mcpOAuthToken.kind, 'refresh')),
    )
    .limit(1);
  const row = rows[0];
  if (
    !row ||
    row.expiresAt < new Date() ||
    row.clientId !== clientId ||
    row.resource !== resource
  ) {
    return null;
  }
  await db.delete(mcpOAuthToken).where(eq(mcpOAuthToken.hash, tokenHash));
  return issueTokens({
    clientId: row.clientId,
    userId: row.userId,
    scopes: row.scopes,
    resource: row.resource,
  });
}

export async function getMcpAuthInfo(
  request: Request,
): Promise<AuthInfo | undefined> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return;
  await ensureOAuthTables();
  const token = authorization.slice(7);
  const rows = await db
    .select()
    .from(mcpOAuthToken)
    .where(
      and(
        eq(mcpOAuthToken.hash, hash(token)),
        eq(mcpOAuthToken.kind, 'access'),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (
    !row ||
    row.expiresAt < new Date() ||
    row.resource !== getMcpResource(request)
  ) {
    return;
  }
  return {
    token,
    clientId: row.clientId,
    scopes: row.scopes.split(' '),
    expiresAt: Math.floor(row.expiresAt.getTime() / 1000),
    resource: new URL(row.resource),
    extra: { userId: row.userId },
  };
}
