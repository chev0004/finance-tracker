import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {
  createTrackerMcpServer,
  mirrorToolSecuritySchemes,
} from '@/lib/mcp/server';
import { getMcpAuthInfo, getResourceMetadataUrl } from '@/lib/oauth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = async (request: Request) => {
  const server = createTrackerMcpServer(getResourceMetadataUrl(request));
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    const authInfo = await getMcpAuthInfo(request);
    const response = await transport.handleRequest(request, { authInfo });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      return response;
    }
    const payload = mirrorToolSecuritySchemes(await response.json());
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(JSON.stringify(payload), {
      status: response.status,
      headers,
    });
  } finally {
    await transport.close();
    await server.close();
  }
};

export const GET = () =>
  Response.json(
    {
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed' },
      id: null,
    },
    { status: 405, headers: { Allow: 'POST' } },
  );

export const DELETE = GET;

export const OPTIONS = () =>
  new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Headers':
        'authorization, content-type, mcp-protocol-version, mcp-session-id',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'mcp-session-id',
    },
  });
