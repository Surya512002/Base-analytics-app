/**
 * Seed self-hosted logos in /public/tokens/<address>.png
 * - Downloads canonical Base tokens (ETH, WETH, USDC, cbBTC, cbETH, AERO, DAI, etc.)
 * - Generates high-res neutral ticker badges for tokenized stocks to respect corporate trademarks
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKENS_DIR = resolve(__dirname, "../public/tokens");

if (!existsSync(TOKENS_DIR)) {
  mkdirSync(TOKENS_DIR, { recursive: true });
}

// Canonical Base tokens to fetch from stable official CDNs
const CANONICAL_TOKENS = [
  {
    symbol: "ETH",
    address: "0x0000000000000000000000000000000000000000",
    url: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  },
  {
    symbol: "WETH",
    address: "0x4200000000000000000000000000000000000006",
    url: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  },
  {
    symbol: "USDC",
    address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    url: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  },
  {
    symbol: "cbBTC",
    address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
    url: "https://assets.coingecko.com/coins/images/40143/small/cbtc.png",
  },
  {
    symbol: "cbETH",
    address: "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22",
    url: "https://assets.coingecko.com/coins/images/27008/small/cbeth.png",
  },
  {
    symbol: "AERO",
    address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    url: "https://assets.coingecko.com/coins/images/31745/small/token.png",
  },
  {
    symbol: "DAI",
    address: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
    url: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
  },
  {
    symbol: "EURC",
    address: "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42",
    url: "https://assets.coingecko.com/coins/images/26045/small/euro.png",
  },
  {
    symbol: "USDT",
    address: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
    url: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  },
  {
    symbol: "wstETH",
    address: "0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452",
    url: "https://assets.coingecko.com/coins/images/18834/small/wstETH.png",
  },
  {
    symbol: "DEGEN",
    address: "0x4ed4e862860bed51a9570b96d89af5e1b0efefed",
    url: "https://assets.coingecko.com/coins/images/34515/small/android-chrome-512x512.png",
  },
  {
    symbol: "VIRTUAL",
    address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b",
    url: "https://assets.coingecko.com/coins/images/35529/small/Logo.png",
  },
  {
    symbol: "BRETT",
    address: "0x532f27101965dd16442e59d40670faf5ebb142e4",
    url: "https://assets.coingecko.com/coins/images/35529/small/Logo.png",
  },
  {
    symbol: "ZORA",
    address: "0x1111111111166b7fe7bd91427724b487980afc69",
    url: "https://assets.coingecko.com/coins/images/54683/small/zora.jpg",
  },
  {
    symbol: "USDbC",
    address: "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca",
    url: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  },
  {
    symbol: "MORPHO",
    address: "0xbaa5cc21fd487b8fcc2f632f3f4e8d37262a0842",
    url: "https://assets.coingecko.com/coins/images/26045/small/euro.png",
  },
  {
    symbol: "TOSHI",
    address: "0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4",
    url: "https://raw.githubusercontent.com/ethereum-optimism/ethereum-optimism.github.io/master/data/TOSHI/logo.png",
  },
  {
    symbol: "HIGHER",
    address: "0x0578d8a44db98b23bf096a382e016e29a5ce0ffe",
    url: "https://raw.githubusercontent.com/ethereum-optimism/ethereum-optimism.github.io/master/data/HIGHER/logo.png",
  },
];

// Helper to generate neutral ticker badge SVG
function generateNeutralTickerSvg(ticker, issuer = "B20", size = 128) {
  const cleanTicker = ticker.replace(/c$/, "").toUpperCase();
  const fontSize = cleanTicker.length <= 4 ? 36 : 28;
  const subLabel = issuer.toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#1e293b" />
      </linearGradient>
      <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.6" />
        <stop offset="100%" stop-color="#0052ff" stop-opacity="0.2" />
      </linearGradient>
    </defs>
    <!-- Background Circle -->
    <circle cx="64" cy="64" r="62" fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="2.5" />
    <circle cx="64" cy="64" r="54" fill="none" stroke="#334155" stroke-width="1" stroke-dasharray="3 3" opacity="0.6" />
    
    <!-- Ticker Text -->
    <text x="64" y="60" text-anchor="middle" dominant-baseline="middle" fill="#f8fafc" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="${fontSize}px" letter-spacing="0.5px">${cleanTicker}</text>
    
    <!-- Issuer / Asset Tag Capsule -->
    <rect x="36" y="84" width="56" height="18" rx="9" fill="#0052ff" fill-opacity="0.25" stroke="#38bdf8" stroke-opacity="0.4" stroke-width="1" />
    <text x="64" y="93.5" text-anchor="middle" dominant-baseline="middle" fill="#93c5fd" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="9.5px" letter-spacing="0.8px">${subLabel}</text>
  </svg>`;
}

async function main() {
  console.log("🚀 [Seed Logos] Seeding /public/tokens/...");

  // 1. Download canonical tokens
  for (const token of CANONICAL_TOKENS) {
    const destPng = resolve(TOKENS_DIR, `${token.address.toLowerCase()}.png`);
    try {
      const res = await fetch(token.url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        // Standardize size to 128x128 PNG
        const standardized = await sharp(buffer)
          .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        writeFileSync(destPng, standardized);
        console.log(`✅ Saved canonical token: ${token.symbol} -> ${token.address.toLowerCase()}.png`);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn(`⚠️ Error downloading ${token.symbol} (${err.message}). Generating fallback vector badge...`);
      let fallbackSvg;
      if (token.symbol === "cbBTC") {
        fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r="62" fill="#F7931A" stroke="#0052FF" stroke-width="4" />
          <circle cx="64" cy="64" r="48" fill="#FFFFFF" fill-opacity="0.15" />
          <text x="64" y="68" text-anchor="middle" dominant-baseline="middle" fill="#FFFFFF" font-family="system-ui, sans-serif" font-weight="900" font-size="34px">₿</text>
          <rect x="36" y="90" width="56" height="18" rx="9" fill="#0052FF" stroke="#FFFFFF" stroke-width="1.5" />
          <text x="64" y="100" text-anchor="middle" dominant-baseline="middle" fill="#FFFFFF" font-family="system-ui, sans-serif" font-weight="800" font-size="10px">cbBTC</text>
        </svg>`;
      } else if (token.symbol === "VIRTUAL") {
        fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r="62" fill="#0B0F19" stroke="#10B981" stroke-width="3.5" />
          <polygon points="44,38 64,82 84,38 72,38 64,62 56,38" fill="#10B981" />
          <text x="64" y="106" text-anchor="middle" dominant-baseline="middle" fill="#A7F3D0" font-family="system-ui, sans-serif" font-weight="800" font-size="11px" letter-spacing="1px">VIRTUAL</text>
        </svg>`;
      } else {
        fallbackSvg = generateNeutralTickerSvg(token.symbol, "BASE", 128);
      }
      const buffer = await sharp(Buffer.from(fallbackSvg)).png().toBuffer();
      writeFileSync(destPng, buffer);
      console.log(`✅ Generated fallback vector badge for: ${token.symbol} -> ${token.address.toLowerCase()}.png`);
    }
  }

  // 2. Load stock registry to generate neutral ticker badges for all 32 stocks
  const { TOKENIZED_STOCKS_REGISTRY } = await import("../lib/stocks/tokenized-stocks-registry.ts");
  console.log(`📊 Found ${TOKENIZED_STOCKS_REGISTRY.length} tokenized stocks in registry.`);

  for (const stock of TOKENIZED_STOCKS_REGISTRY) {
    const lower = stock.address.toLowerCase();
    const destPng = resolve(TOKENS_DIR, `${lower}.png`);
    const svgContent = generateNeutralTickerSvg(stock.underlyingTicker || stock.symbol, stock.issuer || "B20", 128);
    const pngBuffer = await sharp(Buffer.from(svgContent)).png().toBuffer();
    writeFileSync(destPng, pngBuffer);
    console.log(`✅ Generated neutral ticker badge: ${stock.symbol} (${stock.underlyingTicker}) -> ${lower}.png`);
  }

  console.log("🎉 [Seed Logos] All logos successfully seeded in /public/tokens/!");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
