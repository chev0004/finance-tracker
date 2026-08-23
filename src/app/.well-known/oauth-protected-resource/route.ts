import { getMcpResource, getPublicOrigin, TRACKER_SCOPES } from '@/lib/oauth';

export const GET = (request: Request) =>
  Response.json({
    resource: getMcpResource(request),
    authorization_servers: [getPublicOrigin(request)],
    scopes_supported: TRACKER_SCOPES,
  });
