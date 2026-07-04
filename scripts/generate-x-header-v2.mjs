#!/usr/bin/env node
/**
 * X header — white headline only + colored body text + new profile portrait.
 * Usage: node scripts/generate-x-header-v2.mjs
 */
import { readFile, writeFile, mkdir, copyFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public", "x-header-suryaprakash-base.png");
const BRAND = join(ROOT, "public", "brand");
const ASSETS = join(ROOT, "public", "x-header-assets");
const W = 1500;
const H = 500;

const REF_BG = join(ASSETS, "reference-bg.png");
const PROFILE_NEW = join(ASSETS, "profile-new.png");

const REF_BG_CLEAN =
  "/home/surya_prakash/.cursor/projects/home-surya-prakash-Base-analytics-app/assets/x-header-ref-bg-clean.png";
const PROFILE_NEW_SRC =
  "/home/surya_prakash/.cursor/projects/home-surya-prakash-Base-analytics-app/assets/c__Users_Madara_Uchiha_AppData_Roaming_Cursor_User_workspaceStorage_c994eea233ade02479695341b74e8eb9_images_Screenshot_2026-07-03_231450-cc3532d3-4050-4d0c-bd41-d4d2cdacde3f.png";

const TEXT_X = 400;
const HEADLINE_X = 468;
const PORTRAIT_RESERVE = 340;
const TEXT_CLIP_W = W - PORTRAIT_RESERVE - TEXT_X - 24;
const BASE_BLUE = "#0000FF";

function overlaySvg() {
  const x = TEXT_X;
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="textFade" cx="32%" cy="50%" r="40%">
      <stop offset="0%" stop-color="rgba(2,5,8,0.38)"/>
      <stop offset="100%" stop-color="rgba(2,5,8,0)"/>
    </radialGradient>
    <clipPath id="textArea"><rect x="${x - 24}" y="148" width="${TEXT_CLIP_W + 48}" height="310"/></clipPath>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#000" flood-opacity="0.96"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${W - PORTRAIT_RESERVE}" height="${H}" fill="url(#textFade)"/>

  <text x="${HEADLINE_X}" y="144" fill="#ffffff" filter="url(#shadow)" font-family="system-ui,sans-serif" font-size="72" font-weight="900" letter-spacing="3">BUILD ON BASE</text>

  <g clip-path="url(#textArea)">
    <text x="${x + 52}" y="228" fill="#ffffff" filter="url(#shadow)" font-family="system-ui,sans-serif" font-size="48" font-weight="800">Base Analytics</text>

    <text x="${x}" y="290" fill="#7dd3fc" filter="url(#shadow)" font-family="system-ui,sans-serif" font-size="28" font-weight="700">
      Wallet Score · Predictions · Base Voucher
    </text>
    <text x="${x}" y="328" fill="#7dd3fc" filter="url(#shadow)" font-family="system-ui,sans-serif" font-size="28" font-weight="700">
      x402 · Badges · Quests
    </text>

    <text x="${x + 36}" y="382" fill="#e2e8f0" filter="url(#shadow)" font-family="system-ui,sans-serif" font-size="26" font-weight="700">suryaprakash.base.eth</text>

    <text x="${x + 40}" y="438" fill="#ffffff" filter="url(#shadow)" font-family="system-ui,sans-serif" font-size="34" font-weight="900">base-analytics-app.vercel.app</text>
  </g>
</svg>`;
}

async function loadIcon(svgPath, size) {
  return sharp(await readFile(svgPath))
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function loadVisibleBaseLogo(size = 52) {
  const pad = 4;
  const inner = size - pad * 2;
  return sharp(
    Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="6" fill="#ffffff"/>
      <rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="4" fill="${BASE_BLUE}"/>
    </svg>`),
  )
    .png()
    .toBuffer();
}

async function linkIcon(size = 34) {
  return sharp(
    Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`),
  )
    .png()
    .toBuffer();
}

/** Skip screenshot UI chrome (dark sidebar strip on the left). */
async function findProfileCrop(profilePath) {
  const { data, info } = await sharp(profilePath).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;

  const isBlueBg = (r, g, b) => b > 200 && g > 60 && r < 30;

  let left = 0;
  for (let x = 0; x < w; x++) {
    let hits = 0;
    let samples = 0;
    for (let y = 0; y < h; y += 2) {
      const i = (y * w + x) * c;
      samples++;
      if (isBlueBg(data[i], data[i + 1], data[i + 2])) hits++;
    }
    if (hits / samples > 0.55) {
      left = Math.max(0, x);
      break;
    }
  }

  let top = 0;
  for (let y = 0; y < h; y++) {
    let hits = 0;
    let samples = 0;
    for (let x = left; x < w; x += 2) {
      const i = (y * w + x) * c;
      samples++;
      if (isBlueBg(data[i], data[i + 1], data[i + 2])) hits++;
    }
    if (hits / samples > 0.55) {
      top = Math.max(0, y);
      break;
    }
  }

  return { left, top, width: w - left, height: h - top };
}

/** New profile image — crop UI chrome, boost shirt highlight lines. */
async function createProfilePortrait(profilePath, size = 280) {
  const radius = Math.round(size * 0.078);
  const pad = 6;
  const outer = size + pad * 2;

  const crop = await findProfileCrop(profilePath);

  const enhanced = await sharp(profilePath)
    .extract(crop)
    .resize(size, size, { fit: "cover", position: "center" })
    .modulate({ brightness: 1.06, saturation: 1.1 })
    .linear(1.35, -42)
    .sharpen({ sigma: 1.6, m1: 1.35, m2: 0.45 })
    .png()
    .toBuffer();

  const mask = await sharp(
    Buffer.from(
      `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="#fff"/></svg>`,
    ),
  )
    .png()
    .toBuffer();

  const clipped = await sharp(enhanced).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();

  const frame = await sharp(
    Buffer.from(`<svg width="${outer}" height="${outer}" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="${outer - 4}" height="${outer - 4}" rx="${radius + 4}" fill="none" stroke="#00E5FF" stroke-width="2.5" opacity="0.7"/>
    </svg>`),
  )
    .png()
    .toBuffer();

  return {
    buffer: await sharp(frame).composite([{ input: clipped, top: pad, left: pad }]).png().toBuffer(),
    width: outer,
    height: outer,
  };
}

async function loadBg() {
  for (const p of [REF_BG_CLEAN, REF_BG, join(ROOT, "public", "x-header-bg-v2.png")]) {
    try {
      return await sharp(await readFile(p))
        .resize(W, H, { fit: "cover", position: "center" })
        .flop()
        .png()
        .toBuffer();
    } catch {
      /* try next */
    }
  }
  throw new Error("No background image found");
}

async function main() {
  await mkdir(ASSETS, { recursive: true });
  await mkdir(dirname(OUT), { recursive: true });

  try {
    await copyFile(REF_BG_CLEAN, REF_BG);
  } catch {
    /* optional */
  }
  try {
    await copyFile(PROFILE_NEW_SRC, PROFILE_NEW);
  } catch {
    /* optional */
  }

  const bg = await loadBg();
  const { buffer: portrait, width: pW, height: pH } = await createProfilePortrait(PROFILE_NEW, 280);
  const overlay = await sharp(Buffer.from(overlaySvg())).png().toBuffer();
  const baseHeadlineLogo = await loadVisibleBaseLogo(52);
  const appLogo = await loadIcon(join(ROOT, "public", "logo.svg"), 46);
  const basenameLogo = await loadIcon(join(BRAND, "base-square-blue.svg"), 30);
  const urlLink = await linkIcon(34);

  const portraitY = Math.round((H - pH) / 2);
  const portraitX = W - pW - 48;

  const out = await sharp(bg)
    .composite([
      { input: overlay, top: 0, left: 0 },
      { input: baseHeadlineLogo, top: 90, left: TEXT_X },
      { input: appLogo, top: 186, left: TEXT_X },
      { input: basenameLogo, top: 356, left: TEXT_X },
      { input: urlLink, top: 406, left: TEXT_X },
      { input: portrait, top: portraitY, left: portraitX, blend: "over" },
    ])
    .png({ compressionLevel: 9, quality: 92 })
    .toBuffer();

  await writeFile(OUT, out);
  const meta = await sharp(out).metadata();
  console.log(`✓ Saved ${OUT}`);
  console.log(`  ${meta.width}×${meta.height}px · ${(out.length / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
