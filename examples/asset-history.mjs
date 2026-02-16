/**
 * Test: Fetch asset activity history directly from Snipe-IT API
 *
 * This script calls the Snipe-IT reports/activity API directly (not through MCP)
 * and exports the results to a CSV file.
 *
 * Usage:
 *   export SNIPEIT_URL=https://your-snipeit-instance.com
 *   export SNIPEIT_API_TOKEN=your-api-token-here
 *   node asset-history.mjs
 *
 * Edit ASSET_ID below to match the asset you want history for.
 */
import fs from "fs";

const SNIPEIT_URL = process.env.SNIPEIT_URL;
const SNIPEIT_TOKEN = process.env.SNIPEIT_API_TOKEN;
const ASSET_ID = 1; // Change this to your asset's ID

if (!SNIPEIT_URL || !SNIPEIT_TOKEN) {
  console.error("Error: SNIPEIT_URL and SNIPEIT_API_TOKEN environment variables are required");
  process.exit(1);
}

async function main() {
  const res = await fetch(`${SNIPEIT_URL}/api/v1/reports/activity?item_type=asset&item_id=${ASSET_ID}&limit=500`, {
    headers: {
      Authorization: `Bearer ${SNIPEIT_TOKEN}`,
      Accept: "application/json",
    },
  });

  const data = await res.json();
  console.log(`Total activity entries: ${data.total}`);

  if (!data.rows || data.rows.length === 0) {
    console.log("No activity found.");
    process.exit(0);
  }

  // Build CSV
  const headers = ["Date", "Action", "Admin", "Target", "Item", "Note", "Log Meta"];
  const rows = data.rows.map(r => [
    r.created_at?.datetime || "",
    r.action_type || "",
    r.admin?.name || "",
    r.target?.name || r.target?.asset_tag || "",
    r.item?.name || r.item?.asset_tag || "",
    (r.note || "").replace(/"/g, '""').replace(/\n/g, " "),
    (r.log_meta || "").replace(/"/g, '""').replace(/\n/g, " "),
  ]);

  const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");

  const outFile = `asset-${ASSET_ID}-history.csv`;
  fs.writeFileSync(outFile, csv);
  console.log(`Written to ${outFile}`);
  console.log("\nActivity:");
  for (const r of data.rows) {
    console.log(`  ${r.created_at?.formatted} | ${r.action_type} | by ${r.admin?.name || "system"} | target: ${r.target?.name || ""} | note: ${r.note || ""}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
