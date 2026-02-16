/**
 * Test: List users through authenticated MCP tunnel
 *
 * Usage:
 *   export MCP_BASE_URL=https://mcp.yourdomain.com
 *   export MCP_BEARER_TOKEN=your-token-here
 *   node test-users.mjs
 */
import { EventSource } from "eventsource";

const BASE = process.env.MCP_BASE_URL;
const TOKEN = process.env.MCP_BEARER_TOKEN;

if (!BASE || !TOKEN) {
  console.error("Error: MCP_BASE_URL and MCP_BEARER_TOKEN environment variables are required");
  process.exit(1);
}

let messageUrl, initDone = false;

const es = new EventSource(`${BASE}/sse`, {
  fetch: (input, init) => fetch(input, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${TOKEN}` } }),
});

es.addEventListener("endpoint", async (e) => {
  messageUrl = `${BASE}${e.data}`;
  await fetch(messageUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } },
    }),
  });
});

es.addEventListener("message", async (e) => {
  const data = JSON.parse(e.data);
  if (data.id === 1 && data.result && !initDone) {
    initDone = true;
    await fetch(messageUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    await fetch(messageUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 2, method: "tools/call",
        params: { name: "list_users", arguments: { limit: 50 } },
      }),
    });
  }
  if (data.id === 2) {
    const users = JSON.parse(data.result.content[0].text);
    console.log(JSON.stringify(users, null, 2));
    es.close();
    process.exit(0);
  }
});

es.onerror = (err) => { console.error("SSE error:", err.message || err); };
setTimeout(() => { console.error("Timeout"); process.exit(1); }, 15000);
