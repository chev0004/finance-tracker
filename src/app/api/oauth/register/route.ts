import { registerOAuthClient } from '@/lib/oauth';

export const dynamic = 'force-dynamic';

const isHttpsUrl = (value: unknown) => {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export const POST = async (request: Request) => {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const redirectUris = body?.redirect_uris;
  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    !redirectUris.every(isHttpsUrl)
  ) {
    return Response.json({ error: 'invalid_redirect_uri' }, { status: 400 });
  }
  const client = await registerOAuthClient(
    typeof body?.client_name === 'string'
      ? body.client_name
      : 'OpenAI Finance Tracker',
    redirectUris,
  );
  return Response.json(
    {
      client_id: client.id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
    {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
};
