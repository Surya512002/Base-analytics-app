import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAddress, isAddress } from "viem";
import sharp from "sharp";
import { generateTokenPlaceholderSvg } from "@/lib/utils/token-color";
import { getTokenizedStockByAddress } from "@/lib/stocks/tokenized-stocks-registry";

export const dynamic = "force-dynamic";

// Negative cache storing addresses with no external logo for 24h
// address -> timestamp
const negativeCache = new Map<string, number>();
const NEGATIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

import { SELF_HOSTED_LOGOS } from "@/lib/launchpad/token-logo";

// Allowlist of verified external logo providers
const ALLOWED_HOSTS = new Set([
  "assets.coingecko.com",
  "coin-images.coingecko.com",
  "raw.githubusercontent.com",
  "dd.dexscreener.com",
  "cdn.dexscreener.com",
  "tokens.1inch.io",
  "ethereum-optimism.github.io",
  "assets.smold.app",
  "basescan.org",
  "res.cloudinary.com",
  "ipfs.io",
  "assets.parqet.com",
  "www.google.com",
  "metadata.coinbase.com",
]);

/** Well-known Base token CDN links */
const KNOWN_REMOTE_LOGOS: Record<string, string> = {
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913":
    "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  "0x4200000000000000000000000000000000000006":
    "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf":
    "https://assets.coingecko.com/coins/images/40143/small/cbtc.png",
  "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22":
    "https://assets.coingecko.com/coins/images/27008/small/cbeth.png",
  "0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452":
    "https://assets.coingecko.com/coins/images/18834/small/wstETH.png",
  "0x940181a94a35a4569e4529a3cdfb74e38fd98631":
    "https://assets.coingecko.com/coins/images/31745/small/token.png",
  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2":
    "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb":
    "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
  "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42":
    "https://assets.coingecko.com/coins/images/26045/small/euro.png",
  "0x532f27101965dd16442e59d40670faf5ebb142e4":
    "https://assets.coingecko.com/coins/images/35529/small/Logo.png",
  "0x4ed4e862860bed51a9570b96d89af5e1b0efefed":
    "https://assets.coingecko.com/coins/images/34515/small/android-chrome-512x512.png",
};

/**
 * Validates and securely fetches a remote image with timeouts and size limits.
 * Sanitizes SVGs by rasterizing them to PNG so untrusted code is never executed.
 */
async function fetchSafeImage(
  url: string
): Promise<{ buffer: Uint8Array; contentType: string } | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

    const hostname = parsed.hostname.toLowerCase();
    const isAllowed =
      ALLOWED_HOSTS.has(hostname) ||
      [...ALLOWED_HOSTS].some((h) => hostname.endsWith("." + h));
    if (!isAllowed) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "BaseAnalyticsApp/1.0 (+https://base.org)",
        Accept: "image/png,image/jpeg,image/webp,image/svg+xml,*/*;q=0.8",
      },
    });
    clearTimeout(timer);

    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") || "")
      .toLowerCase()
      .split(";")[0]
      .trim();
    const validTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "image/svg+xml",
    ];
    if (!validTypes.includes(contentType)) return null;

    const contentLength = Number(res.headers.get("content-length") || "0");
    if (contentLength > 2 * 1024 * 1024) return null; // 2MB max

    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength > 2 * 1024 * 1024) return null;

    let buffer: Uint8Array = new Uint8Array(arrayBuf);
    let finalContentType = contentType;

    // Security: never inline or pass raw untrusted external SVGs — rasterize with sharp
    if (contentType === "image/svg+xml") {
      try {
        const pngBuf = await sharp(buffer)
          .resize(128, 128, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();
        buffer = new Uint8Array(pngBuf);
        finalContentType = "image/png";
      } catch {
        return null;
      }
    }

    return { buffer, contentType: finalContentType };
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ address: string }> }
) {
  const { address } = await ctx.params;
  const symbol = req.nextUrl.searchParams.get("symbol") || "TK";

  const isEth =
    address.toLowerCase() === "eth" ||
    address === "0x0000000000000000000000000000000000000000";

  const lowerAddress = isEth
    ? "0x0000000000000000000000000000000000000000"
    : address.toLowerCase();

  // 1. Source (b): Check self-hosted /public/tokens/<lowerAddress>.png
  const publicTokensDir = resolve(process.cwd(), "public/tokens");
  const localFile = resolve(publicTokensDir, `${lowerAddress}.png`);

  if (existsSync(localFile)) {
    try {
      const fileData = readFileSync(localFile);
      return new NextResponse(fileData, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control":
            "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        },
      });
    } catch {
      // proceed to next fallback
    }
  }

  // 2. Source (a): Tokenized Stock Registry & Self-Hosted Assets
  if (SELF_HOSTED_LOGOS.has(lowerAddress) || lowerAddress.startsWith("0xb200000000000000000000") || isEth) {
    if (existsSync(localFile)) {
      return NextResponse.redirect(new URL(`/tokens/${lowerAddress}.png`, req.url), 307);
    }
  }

  if (!isEth && isAddress(lowerAddress)) {
    const stock = getTokenizedStockByAddress(lowerAddress);
    if (stock && stock.logo) {
      if (stock.logo.startsWith("/tokens/")) {
        const stockPath = resolve(process.cwd(), "public", stock.logo.slice(1));
        if (existsSync(stockPath)) {
          const fileData = readFileSync(stockPath);
          return new NextResponse(fileData, {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Cache-Control":
                "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
            },
          });
        }
      } else if (stock.logo.startsWith("http")) {
        // Direct remote Coinbase or CDN logo
        const remoteImg = await fetchSafeImage(stock.logo);
        if (remoteImg) {
          return new NextResponse(remoteImg.buffer as unknown as BodyInit, {
            status: 200,
            headers: {
              "Content-Type": remoteImg.contentType,
              "Cache-Control":
                "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
            },
          });
        }
      }
    }
  }

  // 3. Check 24-hour negative cache (avoid repeatedly hitting external CDNs for non-existent art)
  const lastNegative = negativeCache.get(lowerAddress);
  if (lastNegative && Date.now() - lastNegative < NEGATIVE_CACHE_TTL_MS) {
    const svg = generateTokenPlaceholderSvg(address, symbol, 128);
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control":
          "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  }

  // 4. Candidate External Chain:
  // (c) Official Token Lists (CoinGecko / Uniswap / Superchain / TrustWallet)
  // (d) DEX providers (DexScreener)
  const checksum = isAddress(lowerAddress) ? getAddress(lowerAddress) : lowerAddress;
  const candidates: string[] = [];

  if (KNOWN_REMOTE_LOGOS[lowerAddress]) {
    candidates.push(KNOWN_REMOTE_LOGOS[lowerAddress]);
  }

  // Tokenized Stock brand logo candidates (Parqet & Google domain API)
  const stockInfo = getTokenizedStockByAddress(lowerAddress);
  if (stockInfo) {
    const sym = stockInfo.underlyingTicker === "BRK.B" ? "BRK-B" : stockInfo.underlyingTicker;
    candidates.push(`https://assets.parqet.com/logos/symbol/${encodeURIComponent(sym)}?format=png`);
    if (stockInfo.underlyingTicker === "CRCL") {
      candidates.push("https://www.google.com/s2/favicons?domain=circle.com&sz=128");
    }
  }

  // TrustWallet Base token repository
  candidates.push(
    `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${checksum}/logo.png`
  );

  // Smoldapp Base token repository
  candidates.push(
    `https://assets.smold.app/api/token/8453/${checksum}/logo-128.png`
  );

  if (symbol && symbol !== "TK") {
    candidates.push(
      `https://raw.githubusercontent.com/ethereum-optimism/ethereum-optimism.github.io/master/data/${encodeURIComponent(
        symbol
      )}/logo.png`
    );
  }

  candidates.push(`https://dd.dexscreener.com/ds-data/tokens/base/${lowerAddress}.png`);

  for (const candidateUrl of candidates) {
    const result = await fetchSafeImage(candidateUrl);
    if (result) {
      return new NextResponse(result.buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": result.contentType,
          "Cache-Control":
            "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        },
      });
    }
  }

  // 5. Negative Result: Cache for 24h & Return Deterministic Placeholder SVG
  negativeCache.set(lowerAddress, Date.now());
  const fallbackSvg = generateTokenPlaceholderSvg(address, symbol, 128);
  return new NextResponse(fallbackSvg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
