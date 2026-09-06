const MCP_URL = 'http://localhost:8931/mcp';

async function createMcpClient() {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');

  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const client = new Client({
    name: 'self-healing-demo',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);
  return client;
}

async function collectFailureEvidence({ oldLocator, action = 'click', error = 'Element not found', url = '' } = {}) {
  console.log('[MCP] Collecting failure evidence...');

  let client;
  try {
    client = await createMcpClient();
  } catch (err) {
    throw new Error(`Unable to connect to Playwright MCP server at ${MCP_URL}: ${err.message}`);
  }

  let snapshot = '';
  let dom = '';
  let screenshot = '';
  let consoleErrors = [];

  if (url) {
    try {
      await client.callTool({
        name: 'browser_navigate',
        arguments: { url }
      });
      console.log('[MCP] Navigated evidence browser to', url);
    } catch (err) {
      console.warn('[MCP] Evidence browser navigation unavailable:', err.message);
    }
  }

  try {
    const snapshotResult = await client.callTool({ name: 'browser_snapshot', arguments: {} });
    snapshot = snapshotResult?.content?.[0]?.text || JSON.stringify(snapshotResult ?? {});
    console.log('[MCP] Accessibility snapshot collected');
  } catch (err) {
    console.warn('[MCP] browser_snapshot unavailable:', err.message);
  }

  try {
    const domResult = await client.callTool({ name: 'browser_snapshot', arguments: { includeDOM: true } });
    dom = domResult?.content?.[0]?.text || JSON.stringify(domResult ?? {});
    console.log('[MCP] DOM collected');
  } catch (err) {
    console.warn('[MCP] DOM collection unavailable:', err.message);
  }

  try {
    const screenshotResult = await client.callTool({ name: 'browser_take_screenshot', arguments: {} });
    screenshot = screenshotResult?.content?.[0]?.data || screenshotResult?.content?.[0]?.text || '';
    console.log('[MCP] Screenshot collected');
  } catch (err) {
    console.warn('[MCP] Screenshot unavailable:', err.message);
  }

  try {
    const consoleResult = await client.callTool({ name: 'browser_console_messages', arguments: {} });
    consoleErrors = Array.isArray(consoleResult?.content)
      ? consoleResult.content.map((entry) => entry?.text || JSON.stringify(entry ?? {}))
      : [];
  } catch (err) {
    console.warn('[MCP] Console messages unavailable:', err.message);
  }

  try {
    await client.close();
  } catch (_err) {
    // ignore cleanup errors
  }

  return {
    oldLocator,
    action,
    error,
    url,
    accessibilitySnapshot: snapshot,
    dom,
    screenshot,
    consoleErrors
  };
}

module.exports = { collectFailureEvidence };
