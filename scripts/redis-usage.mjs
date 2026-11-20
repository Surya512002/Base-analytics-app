#!/usr/bin/env node
/**
 * What is using the Redis memory? Read-only: lists key sizes and expiry grouped by prefix.
 * It never reads values and never prints the connection URL.
 *
 *   KV_REDIS_URL=rediss://… node scripts/redis-usage.mjs        (PowerShell: $env:KV_REDIS_URL="…"; node scripts/redis-usage.mjs)
 */
import Redis from "ioredis";

const url = (process.env.KV_REDIS_URL || process.env.REDIS_URL || "").trim();
if (!url) {
  console.error("Set KV_REDIS_URL first.");
  process.exit(2);
}
const r = new Redis(url, { tls: url.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined, lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 15000, commandTimeout: 30000 });
// Group by the first 3 parts, hiding addresses and ids so thousands of wallets collapse into one line.
const group = (k) =>
  k.split(":").slice(0, 3).map((p) => (/^0x[0-9a-f]{6,}$/i.test(p) || /^[0-9a-f]{16,}$/i.test(p) || /^\d{6,}$/.test(p) ? "*" : p)).join(":").replace(/(:\*)+$/, ":*");

try {
  await r.connect();
  const info = await r.info("memory");
  const field = (n) => (info.match(new RegExp(`${n}:(.*)`)) || [])[1]?.trim();
  console.log(`used ${field("used_memory_human")} of ${field("maxmemory_human") || "plan limit"} | eviction policy ${field("maxmemory_policy")} | ${await r.dbsize()} keys`);
  const stats = new Map();
  const biggest = [];
  let cursor = "0";
  let n = 0;
  do {
    const [next, keys] = await r.scan(cursor, "COUNT", 500);
    cursor = next;
    if (!keys.length) continue;
    const p = r.pipeline();
    for (const k of keys) {
      p.call("MEMORY", "USAGE", k);
      p.ttl(k);
    }
    const res = await p.exec();
    keys.forEach((k, i) => {
      const bytes = Number(res[i * 2][1]) || 0;
      const ttl = Number(res[i * 2 + 1][1]);
      const g = group(k);
      const s = stats.get(g) ?? { count: 0, bytes: 0, noTtl: 0, max: 0 };
      s.count++;
      s.bytes += bytes;
      s.max = Math.max(s.max, bytes);
      if (ttl === -1) s.noTtl++;
      stats.set(g, s);
      biggest.push([bytes, g, ttl]);
      n++;
    });
  } while (cursor !== "0" && n < 500000);
  console.log("\nprefix | keys | total KB | biggest key KB | keys that never expire");
  [...stats.entries()].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 20).forEach(([g, s]) => console.log(`${g} | ${s.count} | ${(s.bytes / 1024).toFixed(0)} | ${(s.max / 1024).toFixed(0)} | ${s.noTtl}`));
  console.log("\nlargest single keys (prefix | KB | seconds left, -1 = never expires):");
  biggest.sort((a, b) => b[0] - a[0]).slice(0, 8).forEach(([b, g, t]) => console.log(`${g} | ${(b / 1024).toFixed(0)} | ${t}`));
} catch (e) {
  console.error("failed:", String(e.message).replace(/rediss?:\/\/\S+/g, "<url>"));
  process.exitCode = 1;
} finally {
  r.disconnect();
}
