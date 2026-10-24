/**
 * Seed self-hosted logos in /public/tokens/<address>.png
 * - Downloads canonical Base tokens (ETH, WETH, USDC, cbBTC, cbETH, AERO, DAI, etc.)
 * - Downloads authentic corporate brand logos for all 32 tokenized stocks (NVDA, AAPL, TSLA, COIN, MSFT, AMZN, etc.)
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

// Canonical Base tokens to fetch from stable official CDNs with secondary mirrors
const CANONICAL_TOKENS = [
  {
    symbol: "ETH",
    address: "0x0000000000000000000000000000000000000000",
    urls: [
      "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    ],
  },
  {
    symbol: "WETH",
    address: "0x4200000000000000000000000000000000000006",
    urls: [
      "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x4200000000000000000000000000000000000006/logo.png",
    ],
  },
  {
    symbol: "USDC",
    address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    urls: [
      "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71bdA02913/logo.png",
    ],
  },
  {
    symbol: "cbBTC",
    address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
    urls: [
      "https://assets.smold.app/api/token/8453/0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf/logo-128.png",
      "https://assets.coingecko.com/coins/images/40143/small/cbtc.png",
    ],
  },
  {
    symbol: "cbETH",
    address: "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22",
    urls: [
      "https://assets.coingecko.com/coins/images/27008/small/cbeth.png",
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22/logo.png",
    ],
  },
  {
    symbol: "AERO",
    address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    urls: [
      "https://assets.coingecko.com/coins/images/31745/small/token.png",
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x940181a94A35A4569E4529A3CDfB74e38FD98631/logo.png",
    ],
  },
  {
    symbol: "DAI",
    address: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
    urls: [
      "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb/logo.png",
    ],
  },
  {
    symbol: "EURC",
    address: "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42",
    urls: [
      "https://assets.coingecko.com/coins/images/26045/small/euro.png",
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42/logo.png",
    ],
  },
  {
    symbol: "USDT",
    address: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
    urls: [
      "https://assets.coingecko.com/coins/images/325/small/Tether.png",
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2/logo.png",
    ],
  },
  {
    symbol: "wstETH",
    address: "0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452",
    urls: [
      "https://assets.coingecko.com/coins/images/18834/small/wstETH.png",
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452/logo.png",
    ],
  },
  {
    symbol: "DEGEN",
    address: "0x4ed4e862860bed51a9570b96d89af5e1b0efefed",
    urls: [
      "https://assets.coingecko.com/coins/images/34515/small/android-chrome-512x512.png",
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed/logo.png",
    ],
  },
  {
    symbol: "VIRTUAL",
    address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b",
    urls: [
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b/logo.png",
      "https://assets.smold.app/api/token/8453/0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b/logo-128.png",
    ],
  },
  {
    symbol: "BRETT",
    address: "0x532f27101965dd16442e59d40670faf5ebb142e4",
    urls: [
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x532f27101965dd16442E59d40670FaF5eBB142E4/logo.png",
      "https://assets.smold.app/api/token/8453/0x532f27101965dd16442E59d40670FaF5eBB142E4/logo-128.png",
    ],
  },
  {
    symbol: "ZORA",
    address: "0x1111111111166b7fe7bd91427724b487980afc69",
    urls: [
      "https://assets.smold.app/api/token/8453/0x1111111111166b7FE7bd91427724B487980aFc69/logo-128.png",
      "https://dd.dexscreener.com/ds-data/tokens/base/0x1111111111166b7fe7bd91427724b487980afc69.png",
    ],
  },
  {
    symbol: "USDbC",
    address: "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca",
    urls: [
      "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA/logo.png",
    ],
  },
  {
    symbol: "MORPHO",
    address: "0xbaa5cc21fd487b8fcc2f632f3f4e8d37262a0842",
    urls: [
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0xBAa5CC21fd487B8Fcc2F632f3F4E8D37262a0842/logo.png",
      "https://assets.smold.app/api/token/8453/0xBAa5CC21fd487B8Fcc2F632f3F4E8D37262a0842/logo-128.png",
    ],
  },
  {
    symbol: "TOSHI",
    address: "0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4",
    urls: [
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4/logo.png",
      "https://assets.smold.app/api/token/8453/0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4/logo-128.png",
    ],
  },
  {
    symbol: "HIGHER",
    address: "0x0578d8a44db98b23bf096a382e016e29a5ce0ffe",
    urls: [
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe/logo.png",
      "https://assets.smold.app/api/token/8453/0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe/logo-128.png",
    ],
  },
];

// Helper to generate neutral ticker badge SVG fallback
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

// Corporate domains for stock logo resolution fallback
const STOCK_DOMAINS = {
  NVDA: "nvidia.com",
  AAPL: "apple.com",
  TSLA: "tesla.com",
  COIN: "coinbase.com",
  GOOGL: "google.com",
  MSFT: "microsoft.com",
  AMZN: "amazon.com",
  META: "meta.com",
  MSTR: "microstrategy.com",
  CRCL: "circle.com",
  INTC: "intel.com",
  SPCX: "spacex.com",
  SNDK: "sandisk.com",
  PLTR: "palantir.com",
  AMD: "amd.com",
  ARM: "arm.com",
  NFLX: "netflix.com",
  RKLB: "rocketlabusa.com",
  RDDT: "reddit.com",
  RIVN: "rivian.com",
  SOFI: "sofi.com",
  PYPL: "paypal.com",
  UBER: "uber.com",
  WMT: "walmart.com",
  "BRK.B": "berkshirehathaway.com",
  PFE: "pfizer.com",
  LLY: "lilly.com",
  AVGO: "broadcom.com",
  MARA: "mara.com",
  RIOT: "riotplatforms.com",
  GME: "gamestop.com",
  AMC: "amctheatres.com",
};

async function fetchImageBuffer(urls) {
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "image/png,image/jpeg,image/webp,image/svg+xml,*/*;q=0.8",
        },
      });
      clearTimeout(timer);
      if (res.ok) {
        const raw = Buffer.from(await res.arrayBuffer());
        if (raw.byteLength > 200) {
          return raw;
        }
      }
    } catch {
      // try next candidate url
    }
  }
  return null;
}

async function main() {
  console.log("🚀 [Seed Logos] Seeding /public/tokens/...");

  // 1. Download canonical tokens
  for (const token of CANONICAL_TOKENS) {
    const destPng = resolve(TOKENS_DIR, `${token.address.toLowerCase()}.png`);
    const rawBuffer = await fetchImageBuffer(token.urls);
    if (rawBuffer) {
      try {
        const standardized = await sharp(rawBuffer)
          .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        writeFileSync(destPng, standardized);
        console.log(`✅ Saved canonical token: ${token.symbol} -> ${token.address.toLowerCase()}.png`);
        continue;
      } catch (err) {
        console.warn(`⚠️ Error processing sharp for ${token.symbol}: ${err.message}`);
      }
    }

    console.warn(`⚠️ All CDN downloads failed for ${token.symbol}. Generating fallback vector badge...`);
    const fallbackSvg = generateNeutralTickerSvg(token.symbol, "BASE", 128);
    const buffer = await sharp(Buffer.from(fallbackSvg)).png().toBuffer();
    writeFileSync(destPng, buffer);
    console.log(`✅ Generated fallback vector badge for: ${token.symbol} -> ${token.address.toLowerCase()}.png`);
  }

  // 2. Load stock registry to fetch authentic brand logos for all 32 stocks
  const { TOKENIZED_STOCKS_REGISTRY } = await import("../lib/stocks/tokenized-stocks-registry.ts");
  console.log(`📊 Found ${TOKENIZED_STOCKS_REGISTRY.length} tokenized stocks in registry.`);

  for (const stock of TOKENIZED_STOCKS_REGISTRY) {
    const lower = stock.address.toLowerCase();
    const destPng = resolve(TOKENS_DIR, `${lower}.png`);
    const sym = stock.underlyingTicker || stock.symbol.replace(/c$/, "");

    // Build prioritized candidate URLs for authentic company logo
    const candidates = [];

    if (sym === "BRK.B") {
      candidates.push("https://assets.parqet.com/logos/symbol/BRK-B?format=png");
    } else if (sym === "CRCL") {
      candidates.push("https://www.google.com/s2/favicons?domain=circle.com&sz=128");
    } else {
      candidates.push(`https://assets.parqet.com/logos/symbol/${encodeURIComponent(sym)}?format=png`);
    }

    // Secondary domain favicon mirror
    const domain = STOCK_DOMAINS[sym];
    if (domain) {
      candidates.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`);
    }

    const rawBuffer = await fetchImageBuffer(candidates);

    if (rawBuffer) {
      try {
        const standardized = await sharp(rawBuffer)
          .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        writeFileSync(destPng, standardized);
        console.log(`✅ Saved authentic brand logo: ${stock.symbol} (${sym}) -> ${lower}.png`);
        continue;
      } catch (err) {
        console.warn(`⚠️ Error resizing brand logo for ${stock.symbol}: ${err.message}`);
      }
    }

    // Safety fallback only if network completely unavailable
    console.warn(`⚠️ Could not download brand logo for ${stock.symbol}. Using ticker badge...`);
    const svgContent = generateNeutralTickerSvg(sym, stock.issuer || "B20", 128);
    const pngBuffer = await sharp(Buffer.from(svgContent)).png().toBuffer();
    writeFileSync(destPng, pngBuffer);
    console.log(`✅ Generated neutral ticker badge: ${stock.symbol} (${sym}) -> ${lower}.png`);
  }

  console.log("🎉 [Seed Logos] All logos successfully seeded in /public/tokens/!");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});

