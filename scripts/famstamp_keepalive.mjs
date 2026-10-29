#!/usr/bin/env node
// Famstamp keep-alive + size watch (v110). Free Supabase projects pause after about a week with no traffic; this makes one
// small read so the project stays awake, and warns when the database or photo storage gets near the free limits.
// Uses only the PUBLIC publishable key (the same one in travel-log/app/sync-config.js). Read-only. No secrets needed.
//   node scripts/famstamp_keepalive.mjs            -> prints sizes, exit 1 if over WARN (80%) so a scheduled job shows red
// Env: FS_URL, FS_KEY (default: read from sync-config.js), WARN (0.8), DB_LIMIT_MB (500), PHOTO_LIMIT_MB (1024)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const here = fileURLToPath(new URL("../travel-log/app/sync-config.js", import.meta.url));
let url = process.env.FS_URL, key = process.env.FS_KEY;
if (!url || !key) { const src = readFileSync(here, "utf8"); url = url || /url:\s*"([^"]+)"/.exec(src)[1]; key = key || /key:\s*"([^"]+)"/.exec(src)[1]; }
const WARN = +(process.env.WARN || 0.8), DB = +(process.env.DB_LIMIT_MB || 500) * 1048576, PH = +(process.env.PHOTO_LIMIT_MB || 1024) * 1048576;
const h = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
const mb = (b) => (b / 1048576).toFixed(1) + " MB";
async function main() {
  const r = await fetch(url + "/rest/v1/rpc/famstamp_usage", { method: "POST", headers: h, body: "{}" });
  if (r.ok) {
    const u = await r.json(), dbp = u.db_bytes / DB, php = u.photo_bytes / PH;
    console.log(`awake: database ${mb(u.db_bytes)} (${Math.round(dbp * 100)}% of free), photos ${u.photos} = ${mb(u.photo_bytes)} (${Math.round(php * 100)}% of free)`);
    if (dbp > WARN || php > WARN) { console.log("WARNING: over " + Math.round(WARN * 100) + "% of a free-plan limit"); process.exit(1); }
    return;
  }
  // usage function not installed yet: any request still counts as activity
  const r2 = await fetch(url + "/rest/v1/families?select=id&limit=1", { headers: h });
  console.log("awake (usage function not installed: " + r.status + "); fallback ping " + r2.status);
  if (r2.status >= 500) process.exit(2);
}
main().catch((e) => { console.error("ping failed: " + e.message); process.exit(2); });
