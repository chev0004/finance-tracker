import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';

const testDirectory = await mkdtemp(join(tmpdir(), 'finance-oauth-test-'));
process.env.DATABASE_URL = `file:${join(testDirectory, 'tracker.db')}`;
process.env.BETTER_AUTH_URL = 'https://tracker.example';

const client = createClient({ url: process.env.DATABASE_URL });
await client.execute(`CREATE TABLE user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_verified INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);
await client.execute({
  sql: `INSERT INTO user
    (id, name, email, email_verified, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`,
  args: ['user-a', 'A', 'a@example.com', 1, Date.now(), Date.now()],
});

const {
  createAuthorizationCode,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  getMcpAuthInfo,
  registerOAuthClient,
} = await import('@/lib/oauth');

const redirectUri = 'https://chatgpt.com/connector/oauth/test';
const resource = 'https://tracker.example/api/mcp';
const oauthClient = await registerOAuthClient('OpenAI', [redirectUri]);
const verifier = 'test-verifier-with-enough-entropy-1234567890';
const code = await createAuthorizationCode({
  clientId: oauthClient.id,
  userId: 'user-a',
  redirectUri,
  codeChallenge: createHash('sha256').update(verifier).digest('base64url'),
  scopes: ['tracker:read', 'tracker:write'],
  resource,
});
const tokens = await exchangeAuthorizationCode({
  code,
  clientId: oauthClient.id,
  redirectUri,
  codeVerifier: verifier,
  resource,
});
assert.ok(tokens);
assert.equal(
  await exchangeAuthorizationCode({
    code,
    clientId: oauthClient.id,
    redirectUri,
    codeVerifier: verifier,
    resource,
  }),
  null,
);

const authInfo = await getMcpAuthInfo(
  new Request(resource, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  }),
);
assert.equal(authInfo?.extra?.userId, 'user-a');
assert.deepEqual(authInfo?.scopes, ['tracker:read', 'tracker:write']);

const refreshed = await exchangeRefreshToken(
  tokens.refresh_token,
  oauthClient.id,
  resource,
);
assert.ok(refreshed);
assert.equal(
  await exchangeRefreshToken(tokens.refresh_token, oauthClient.id, resource),
  null,
);

client.close();
