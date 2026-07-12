#!/usr/bin/env node
/**
 * Generate public/app-thumbnail.png (1200×628, 1.91:1, under 1 MB) for Base App dashboard.
 * Usage: node scripts/generate-app-thumbnail.mjs [--url https://base-analytics-app.vercel.app]
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public", "app-thumbnail.png");
const MAX_BYTES = 1024 * 1024;

const argUrl = process.argv.find((a) => a.startsWith("--url="))?.slice(6);
const useLocal = process.argv.includes("--local");

function waitForUrl(url, attempts = 60) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const tick = () => {
      const lib = url.startsWith("https") ? https : http;
      lib
        .get(url, (res) => {
          res.resume();
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) resolve();
          else if (++n >= attempts) reject(new Error(`Timeout waiting for ${url}`));
          else setTimeout(tick, 2000);
        })
        .on("error", () => {
          if (++n >= attempts) reject(new Error(`Timeout waiting for ${url}`));
          else setTimeout(tick, 2000);
        });
    };
    tick();
  });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`GET ${url} → ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function main() {
  let base = argUrl ?? (useLocal ? "http://127.0.0.1:3000" : "https://base-analytics-app.vercel.app");
  let devProc = null;

  if (useLocal && !argUrl) {
    devProc = spawn("npm", ["run", "dev"], {
      cwd: ROOT,
      stdio: "ignore",
      env: { ...process.env, PORT: "3000" },
    });
    await waitForUrl("http://127.0.0.1:3000/api/health");
    base = "http://127.0.0.1:3000";
  }

  try {
    const thumbUrl = `${base.replace(/\/$/, "")}/thumbnail-image`;
    console.log(`Fetching ${thumbUrl} …`);
    const buf = await fetchBuffer(thumbUrl);

    if (buf.length > MAX_BYTES) {
      console.warn(`Warning: ${buf.length} bytes exceeds 1 MB — saving anyway`);
    }

    fs.writeFileSync(OUT, buf);
    console.log(`Saved ${OUT} (${buf.length} bytes, ${Math.round(buf.length / 1024)} KB)`);
  } finally {
    if (devProc) {
      devProc.kill("SIGTERM");
    }
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
