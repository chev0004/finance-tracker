import { auth } from '@/lib/auth';
import {
  createAuthorizationCode,
  getMcpResource,
  getOAuthClient,
  parseScopes,
} from '@/lib/oauth';

export const dynamic = 'force-dynamic';

const invalid = (message: string) =>
  Response.json(
    { error: 'invalid_request', error_description: message },
    { status: 400 },
  );

const readAuthorization = async (request: Request) => {
  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id') ?? '';
  const redirectUri = url.searchParams.get('redirect_uri') ?? '';
  const codeChallenge = url.searchParams.get('code_challenge') ?? '';
  const resource = url.searchParams.get('resource') ?? getMcpResource(request);
  const scopes = parseScopes(url.searchParams.get('scope'));
  const client = await getOAuthClient(clientId);
  if (
    url.searchParams.get('response_type') !== 'code' ||
    url.searchParams.get('code_challenge_method') !== 'S256' ||
    !codeChallenge ||
    !client?.redirectUris.includes(redirectUri) ||
    resource !== getMcpResource(request) ||
    !scopes
  ) {
    return null;
  }
  return {
    url,
    client,
    clientId,
    redirectUri,
    codeChallenge,
    resource,
    scopes,
  };
};

const loginRedirect = (url: URL) => {
  const callbackUrl = `${url.pathname}${url.search}`;
  return Response.redirect(
    new URL(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`, url),
  );
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const consentPage = (clientName: string, scopes: string[]) =>
  new Response(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect Finance Tracker</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; font-family: system-ui, sans-serif; }
  main { width: min(100% - 32px, 440px); }
  h1 { font-size: 24px; }
  li { margin: 8px 0; }
  form { display: flex; gap: 10px; margin-top: 24px; }
  button { flex: 1; padding: 11px 16px; border: 1px solid ButtonBorder; border-radius: 8px; background: ButtonFace; color: ButtonText; font: inherit; cursor: pointer; }
  button[value="allow"] { font-weight: 700; }
</style>
</head>
<body>
<main>
  <h1>Connect ${escapeHtml(clientName)}?</h1>
  <p>This connection is limited to the Finance Tracker account currently signed in.</p>
  <ul>${scopes
    .map((scope) =>
      scope === 'tracker:read'
        ? '<li>View every cloud tracker field and projection branch</li>'
        : '<li>Add pocket spending, recurring expenses, goals, one-time income, and recurring-date price overrides when you ask</li>',
    )
    .join('')}</ul>
  <form method="post">
    <button type="submit" name="decision" value="deny">Cancel</button>
    <button type="submit" name="decision" value="allow">Allow</button>
  </form>
</main>
</body>
</html>`,
    {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://chatgpt.com; frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer',
        'X-Frame-Options': 'DENY',
      },
    },
  );

export const GET = async (request: Request) => {
  const authorization = await readAuthorization(request);
  if (!authorization) return invalid('The authorization request is invalid');
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return loginRedirect(authorization.url);
  return consentPage(authorization.client.name, authorization.scopes);
};

export const POST = async (request: Request) => {
  const authorization = await readAuthorization(request);
  if (!authorization) return invalid('The authorization request is invalid');
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return loginRedirect(authorization.url);

  const destination = new URL(authorization.redirectUri);
  const state = authorization.url.searchParams.get('state');
  if (state) destination.searchParams.set('state', state);
  const body = await request.formData();
  if (body.get('decision') !== 'allow') {
    destination.searchParams.set('error', 'access_denied');
    return Response.redirect(destination);
  }

  const code = await createAuthorizationCode({
    clientId: authorization.clientId,
    userId: session.user.id,
    redirectUri: authorization.redirectUri,
    codeChallenge: authorization.codeChallenge,
    scopes: authorization.scopes,
    resource: authorization.resource,
  });
  destination.searchParams.set('code', code);
  return Response.redirect(destination);
};
