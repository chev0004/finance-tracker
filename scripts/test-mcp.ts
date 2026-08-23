import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  createTrackerMcpServer,
  mirrorToolSecuritySchemes,
} from '@/lib/mcp/server';

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const server = createTrackerMcpServer(
  'https://tracker.example/.well-known/oauth-protected-resource',
);
const client = new Client({ name: 'tracker-test', version: '1.0.0' });

await server.connect(serverTransport);
await client.connect(clientTransport);

const tools = await client.listTools();
assert.deepEqual(tools.tools.map(({ name }) => name).sort(), [
  'add_one_time_income',
  'add_pocket_expenses',
  'add_recurring_expense',
  'add_savings_goal',
  'get_tracker',
  'set_recurring_expense_amounts',
]);
assert.deepEqual(
  tools.tools.find(({ name }) => name === 'get_tracker')?._meta
    ?.securitySchemes,
  [{ type: 'oauth2', scopes: ['tracker:read'] }],
);
assert.deepEqual(
  tools.tools.find(({ name }) => name === 'get_tracker')?.inputSchema.required,
  ['asOfDate'],
);
for (const tool of tools.tools) {
  const schema = tool.inputSchema;
  assert.ok(schema && 'properties' in schema);
  assert.ok(!('userId' in (schema.properties ?? {})));
  assert.ok(!('accountId' in (schema.properties ?? {})));
}
const toolListPayload = {
  result: { tools: tools.tools.map((tool) => ({ ...tool })) },
};
mirrorToolSecuritySchemes(toolListPayload);
assert.deepEqual(
  (
    toolListPayload.result.tools.find(
      ({ name }) => name === 'add_pocket_expenses',
    ) as Record<string, unknown>
  ).securitySchemes,
  [{ type: 'oauth2', scopes: ['tracker:write'] }],
);

const protectedRead = await client.callTool({
  name: 'get_tracker',
  arguments: { asOfDate: '2026-08-23' },
});
assert.equal(protectedRead.isError, true);
assert.match(
  String(protectedRead._meta?.['mcp/www_authenticate']),
  /oauth-protected-resource/,
);

await client.close();
await server.close();
