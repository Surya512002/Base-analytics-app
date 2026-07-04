#!/usr/bin/env node
/**
 * Generate X (Twitter) header — 1500×500 with official Base brand assets.
 * Usage: node scripts/generate-x-header.mjs [backgroundPng]
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public", "x-header-suryaprakash-base.png");
const BRAND = join(ROOT, "public", "brand");
const W = 1500;
const H = 500;

const DEFAULT_BG = join(ROOT, "public", "x-header-bg-v2.png");

const PRODUCTS = [
  { label: "Base Analytics", sub: "Wallet score and onchain rank" },
  { label: "Predictions", sub: "BTC · ETH · SOL markets" },
  { label: "Base Voucher", sub: "USDC and ETH gift cards" },
  { label: "x402 Pay", sub: "Micropay premium scans" },
  { label: "Badges", sub: "40+ gasless achievements" },
  { label: "Quests", sub: "Season leaderboard and XP" },
];

function productCardsSvg() {
  const startX = 400;
  const cardW = 168;
  const gap = 14;
  const cards = PRODUCTS.map((p, i) => {
    const x = startX + i * (cardW + gap);
    const y = 268;
    const colors = ["#00E5FF", "#10b981", "#a78bfa", "#f59e0b", "#f472b6", "#38bdf8"];
    const c = colors[i];
    return `
      <g transform="translate(${x}, ${y})">
        <rect width="${cardW}" height="108" rx="14" fill="rgba(255,255,255,0.07)" stroke="${c}55" stroke-width="1.2"/>
        <rect x="0" y="0" width="4" height="108" rx="2" fill="${c}"/>
        <circle cx="22" cy="28" r="6" fill="${c}"/>
        <text x="36" y="33" fill="#ffffff" font-family="system-ui,sans-serif" font-size="13" font-weight="800">${p.label}</text>
        <text x="14" y="58" fill="rgba(148,163,184,0.95)" font-family="system-ui,sans-serif" font-size="10" font-weight="600">${p.sub}</text>
      </g>`;
  }).join("");

  const orbitY = 322;
  const orbitW = PRODUCTS.length * (cardW + gap) - gap;
  return `
    <path d="M ${startX - 20} ${orbitY} Q ${startX + orbitW / 2} ${orbitY - 40} ${startX + orbitW + 20} ${orbitY}"
      fill="none" stroke="rgba(0,229,255,0.2)" stroke-width="1.5" stroke-dasharray="6 8"/>
    ${cards}`;
}

function overlaySvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="headGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="55%" stop-color="#00E5FF"/>
      <stop offset="100%" stop-color="#0052FF"/>
    </linearGradient>
    <linearGradient id="cardGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(0,229,255,0.12)"/>
      <stop offset="100%" stop-color="rgba(0,82,255,0.04)"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="leftFade" cx="0%" cy="50%" r="70%">
      <stop offset="0%" stop-color="rgba(2,5,8,0.92)"/>
      <stop offset="100%" stop-color="rgba(2,5,8,0)"/>
    </radialGradient>
  </defs>

  <!-- readability fade over busy background -->
  <rect x="0" y="0" width="920" height="${H}" fill="url(#leftFade)"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(2,5,8,0.35)"/>

  <!-- wallet score widget -->
  <g transform="translate(1280, 200)">
    <circle cx="0" cy="0" r="52" fill="rgba(255,255,255,0.05)" stroke="rgba(0,229,255,0.4)" stroke-width="2"/>
    <circle cx="0" cy="0" r="52" fill="none" stroke="#10b981" stroke-width="4" stroke-dasharray="220 110" stroke-linecap="round" transform="rotate(-90)"/>
    <text x="0" y="-4" text-anchor="middle" fill="#ffffff" font-family="system-ui,sans-serif" font-size="28" font-weight="900">72</text>
    <text x="0" y="16" text-anchor="middle" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="9" font-weight="700">SCORE</text>
  </g>

  <!-- builder badge -->
  <rect x="400" y="36" width="118" height="28" rx="14" fill="rgba(0,82,255,0.25)" stroke="rgba(0,229,255,0.5)" stroke-width="1"/>
  <text x="414" y="55" fill="#00E5FF" font-family="system-ui,sans-serif" font-size="11" font-weight="800" letter-spacing="2">BUILDER</text>

  <!-- headline -->
  <text x="400" y="118" fill="url(#headGrad)" font-family="system-ui,sans-serif" font-size="50" font-weight="900" letter-spacing="-1">I Build on Base</text>

  <!-- handle -->
  <text x="400" y="158" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="18" font-weight="600">suryaprakash.base.eth</text>
  <text x="620" y="158" fill="rgba(148,163,184,0.5)" font-family="system-ui,sans-serif" font-size="18">·</text>
  <text x="638" y="158" fill="#64748b" font-family="system-ui,sans-serif" font-size="18" font-weight="500">Onchain apps and analytics</text>

  <!-- tagline strip -->
  <rect x="400" y="178" width="680" height="2" fill="rgba(0,229,255,0.35)" rx="1"/>
  <text x="400" y="212" fill="#e2e8f0" font-family="system-ui,sans-serif" font-size="15" font-weight="600">
    Gamified wallet analytics · prediction markets · crypto gift vouchers · gasless badges
  </text>

  ${productCardsSvg()}

  <!-- live app pill -->
  <rect x="400" y="398" width="200" height="36" rx="18" fill="rgba(16,185,129,0.15)" stroke="rgba(16,185,129,0.45)" stroke-width="1"/>
  <circle cx="418" cy="416" r="5" fill="#10b981"/>
  <text x="432" y="421" fill="#6ee7b7" font-family="system-ui,sans-serif" font-size="12" font-weight="700">LIVE · base-analytics-app.vercel.app</text>
</svg>`;
}

async function loadPngFromSvg(svgPath, size) {
  return sharp(await readFile(svgPath)).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

async function loadWordmark(height) {
  const svg = await readFile(join(BRAND, "base-wordmark-white.svg"));
  const width = Math.round(height * (1280 / 417.43));
  return sharp(svg).resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

async function main() {
  const bgPath = process.argv[2] || DEFAULT_BG;
  await mkdir(dirname(OUT), { recursive: true });

  let bg;
  try {
    bg = await sharp(await readFile(bgPath))
      .resize(W, H, { fit: "cover", position: "center" })
      .png()
      .toBuffer();
  } catch {
    bg = await sharp({
      create: { width: W, height: H, channels: 4, background: { r: 2, g: 5, b: 8, alpha: 1 } },
    })
      .composite([
        {
          input: Buffer.from(`<svg width="${W}" height="${H}"><defs><radialGradient id="a" cx="80%" cy="20%"><stop offset="0%" stop-color="#0052FF" stop-opacity="0.35"/><stop offset="100%" stop-color="#020508" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="#020508"/><rect width="${W}" height="${H}" fill="url(#a)"/></svg>`),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();
  }

  const overlay = await sharp(Buffer.from(overlaySvg())).png().toBuffer();
  const baseSquare = await loadPngFromSvg(join(BRAND, "base-square-blue.svg"), 88);
  const baseWordmark = await loadWordmark(42);

  const out = await sharp(bg)
    .composite([
      { input: overlay, top: 0, left: 0 },
      { input: baseSquare, top: 88, left: 288 },
      { input: baseWordmark, top: 44, left: W - 300 },
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
