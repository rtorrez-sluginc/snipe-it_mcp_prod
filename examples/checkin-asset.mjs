/**
 * Test: Multi-step workflow — find an asset, then check it in
 *
 * Usage:
 *   export MCP_BASE_URL=https://mcp.yourdomain.com
 *   export MCP_BEARER_TOKEN=your-token-here
 *   node checkin-asset.mjs
 *
 * This script:
 *   1. Lists assets to find one by asset tag
 *   2. Checks in the found asset with a note
 *
 * Edit ASSET_TAG below to match an asset in your Snipe-IT instance.
 */
import { EventSource } from "eventsource";

const BASE = process.env.MCP_BASE_URL;
const TOKEN = process.env.MCP_BEARER_TOKEN;
const ASSET_TAG = "ASSET-001"; // Change this to match your asset tag

if (!BASE || !TOKEN) {
  console.error("Error: MCP_BASE_URL and MCP_BEARER_TOKEN environment variables are required");
  process.exit(1);
}

let messageUrl, step = 0;

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

  if (data.id === 1 && step === 0) {
    step = 1;
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
        params: { name: "list_assets", arguments: { limit: 50 } },
      }),
    });
  }

  if (data.id === 2) {
    const assets = JSON.parse(data.result.content[0].text);
    const asset = assets.rows.find(a => a.asset_tag === ASSET_TAG);
    if (!asset) {
      console.log(`Asset ${ASSET_TAG} not found`);
      es.close();
      process.exit(1);
    }
    console.log(`Found asset ID: ${asset.id} | Assigned to: ${asset.assigned_to?.name || "unassigned"}`);
    console.log("Checking in asset...");
    await fetch(messageUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 3, method: "tools/call",
        params: { name: "checkin_asset", arguments: { asset_id: asset.id, note: "Checked in via MCP tunnel" } },
      }),
    });
  }

  if (data.id === 3) {
    const result = JSON.parse(data.result.content[0].text);
    console.log("Check-in result:", result.status, "|", result.messages);
    es.close();
    process.exit(0);
  }
});

es.onerror = (err) => { console.error("SSE error:", err.message || err); };
setTimeout(() => { console.error("Timeout"); process.exit(1); }, 15000);
