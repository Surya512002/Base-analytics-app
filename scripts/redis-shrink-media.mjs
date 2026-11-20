#!/usr/bin/env node
/**
 * Shrink the launchpad images already stored in Redis (old uploads kept the original, up to ~800 KB each).
 * Same keys and same expiry, so every logo URL keeps working; only the bytes get smaller.
 * Dry run by default: it only reports what it WOULD save. Add --apply to write.
 *
 *   KV_REDIS_URL=rediss://… node scripts/redis-shrink-media.mjs            (report only)
 *   KV_REDIS_URL=rediss://… node scripts/redis-shrink-media.mjs --apply    (shrink)
 */
import Redis from "ioredis";
import sharp from "sharp";

const apply = process.argv.includes("--apply");
const url = (process.env.KV_REDIS_URL || process.env.REDIS_URL || "").trim();
if (!url) {
  console.error("Set KV_REDIS_URL first.");
  process.exit(2);
}
const r = new Redis(url, { tls: url.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined, lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 15000, commandTimeout: 30000 });
const MIN_BASE64 = 100_000; // below this (about 75 KB of image) it's already small

let before = 0;
let after = 0;
let touched = 0;
let seen = 0;
try {
  await r.connect();
  let cursor = "0";
  do {
    const [next, keys] = await r.scan(cursor, "MATCH", "launchpad:media:*", "COUNT", 200);
    cursor = next;
    for (const key of keys) {
      seen++;
      const raw = await r.get(key);
      if (!raw) continue;
      let entry;
      try {
        entry = JSON.parse(raw);
      } catch {
        continue;
      }
      if (typeof entry?.data !== "string" || entry.data.length < MIN_BASE64 || entry.mime === "image/webp" && entry.data.length < MIN_BASE64 * 2) continue;
      const input = Buffer.from(entry.data, "base64");
      let out;
      try {
        out = await sharp(input, { animated: false }).rotate().resize(512, 512, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      } catch {
        continue; // not decodable: leave it alone
      }
      if (out.length >= input.length) continue;
      const next64 = out.toString("base64");
      before += raw.length;
      after += JSON.stringify({ mime: "image/webp", data: next64 }).length;
      touched++;
      if (apply) {
        const ttl = await r.ttl(key);
        const value = JSON.stringify({ mime: "image/webp", data: next64 });
        if (ttl > 0) await r.set(key, value, "EX", ttl);
        else await r.set(key, value);
      }
    }
  } while (cursor !== "0");
  const mb = (n) => (n / 1024 / 1024).toFixed(2);
  console.log(`${seen} images checked, ${touched} ${apply ? "shrunk" : "can be shrunk"}: ${mb(before)} MB -> ${mb(after)} MB (saves ${mb(before - after)} MB)`);
  if (!apply && touched) console.log("Run again with --apply to do it.");
} catch (e) {
  console.error("failed:", String(e.message).replace(/rediss?:\/\/\S+/g, "<url>"));
  process.exitCode = 1;
} finally {
  r.disconnect();
}
