import {
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  getMcpResource,
} from '@/lib/oauth';

export const dynamic = 'force-dynamic';

const invalidGrant = () =>
  Response.json(
    { error: 'invalid_grant' },
    { status: 400, headers: { 'Cache-Control': 'no-store' } },
  );

export const POST = async (request: Request) => {
  const body = await request.formData();
  const grantType = String(body.get('grant_type') ?? '');
  const clientId = String(body.get('client_id') ?? '');
  const resource = String(body.get('resource') ?? getMcpResource(request));
  if (!clientId || resource !== getMcpResource(request)) {
    return invalidGrant();
  }

  const tokens =
    grantType === 'authorization_code'
      ? await exchangeAuthorizationCode({
          code: String(body.get('code') ?? ''),
          clientId,
          redirectUri: String(body.get('redirect_uri') ?? ''),
          codeVerifier: String(body.get('code_verifier') ?? ''),
          resource,
        })
      : grantType === 'refresh_token'
        ? await exchangeRefreshToken(
            String(body.get('refresh_token') ?? ''),
            clientId,
            resource,
          )
        : null;

  return tokens
    ? Response.json(tokens, { headers: { 'Cache-Control': 'no-store' } })
    : invalidGrant();
};
