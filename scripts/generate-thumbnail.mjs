#!/usr/bin/env node
/**
 * Generate app thumbnail PNG at 1.91:1, max 1 MB.
 * Usage: node scripts/generate-thumbnail.mjs [baseUrl]
 */
import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public", "app-thumbnail.png");
const MAX_BYTES = 1024 * 1024;
const TARGET_W = 1200;
const TARGET_H = Math.round(TARGET_W / 1.91);

const baseUrl = process.argv[2] || "http://localhost:3000";

async function fetchPng() {
  const url = `${baseUrl.replace(/\/$/, "")}/thumbnail-image`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch thumbnail (${res.status}): ${url}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function compressToLimit(input) {
  let quality = 92;
  let palette = false;

  for (let attempt = 0; attempt < 12; attempt++) {
    let pipeline = sharp(input).resize(TARGET_W, TARGET_H, { fit: "fill" });

    if (palette) {
      pipeline = pipeline.png({ compressionLevel: 9, palette: true, quality, colors: 256 });
    } else {
      pipeline = pipeline.png({ compressionLevel: 9, quality });
    }

    const out = await pipeline.toBuffer();
    if (out.length <= MAX_BYTES) {
      return out;
    }

    if (quality > 70) {
      quality -= 8;
    } else if (!palette) {
      palette = true;
      quality = 80;
    } else if (quality > 50) {
      quality -= 10;
    } else {
      return sharp(input)
        .resize(Math.round(TARGET_W * 0.9), Math.round(TARGET_H * 0.9), { fit: "fill" })
        .png({ compressionLevel: 9, palette: true, quality: 60, colors: 128 })
        .toBuffer();
    }
  }

  throw new Error("Could not compress thumbnail under 1 MB");
}

async function main() {
  console.log(`Fetching ${TARGET_W}×${TARGET_H} (1.91:1) from ${baseUrl}…`);
  const raw = await fetchPng();
  console.log(`Raw PNG: ${(raw.length / 1024).toFixed(1)} KB — compressing…`);

  const compressed = await compressToLimit(raw);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, compressed);

  const meta = await sharp(compressed).metadata();
  const kb = (compressed.length / 1024).toFixed(1);
  console.log(`✓ Saved ${OUT}`);
  console.log(`  ${meta.width}×${meta.height}px · ${kb} KB · ${(meta.width / meta.height).toFixed(3)}:1`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
