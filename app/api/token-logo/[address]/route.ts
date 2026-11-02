import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAddress, isAddress } from "viem";
import sharp from "sharp";
import { generateTokenPlaceholderSvg } from "@/lib/utils/token-color";
import {
  getTokenizedStockByAddress,
  getTokenizedStockBySymbol,
} from "@/lib/stocks/tokenized-stocks-registry";
import { SELF_HOSTED_LOGOS } from "@/lib/launchpad/token-logo";
import { findVerifiedToken, getVerifiedTokenLogo } from "@/lib/swap/verified-tokens";

export const dynamic = "force-dynamic";

// Negative cache storing addresses with no external logo for 2 minutes (preventing CDN abuse without locking out recovered assets)
const negativeCache = new Map<string, number>();
const NEGATIVE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

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
  "assets.geckoterminal.com",
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
  "0x1111111111166b7fe7bd91427724b487980afc69":
    "https://assets.coingecko.com/coins/images/54683/small/zora.jpg",
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
  const rawSymbol = req.nextUrl.searchParams.get("symbol") || "TK";
  const cleanSymbol = rawSymbol.replace(/^\$/, "").trim() || "TK";
  const baseTicker = cleanSymbol.split(/[-/_ ]/)[0] || cleanSymbol;

  const isEth =
    address.toLowerCase() === "eth" ||
    address === "0x0000000000000000000000000000000000000000" ||
    cleanSymbol.toUpperCase() === "ETH" ||
    baseTicker.toUpperCase() === "ETH";

  const lowerAddress = isEth
    ? "0x0000000000000000000000000000000000000000"
    : address.toLowerCase();

  const publicTokensDir = resolve(process.cwd(), "public/tokens");

  // 1. Check self-hosted /public/tokens/<lowerAddress>.png
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

  // 2. Tokenized Stock Registry (by address, symbol, or compound ticker)
  const stock =
    getTokenizedStockByAddress(lowerAddress) ||
    getTokenizedStockBySymbol(cleanSymbol) ||
    getTokenizedStockBySymbol(baseTicker) ||
    getTokenizedStockBySymbol(`${cleanSymbol}c`) ||
    getTokenizedStockBySymbol(`${baseTicker}c`) ||
    getTokenizedStockBySymbol(cleanSymbol.replace(/c$/i, "")) ||
    getTokenizedStockBySymbol(baseTicker.replace(/c$/i, ""));

  if (stock) {
    const stockLocalPath = resolve(publicTokensDir, `${stock.address.toLowerCase()}.png`);
    if (existsSync(stockLocalPath)) {
      try {
        const fileData = readFileSync(stockLocalPath);
        return new NextResponse(fileData, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control":
              "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
          },
        });
      } catch {
        // proceed
      }
    }

    if (stock.logo) {
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

    // Try Parqet ticker for stock
    const ticker = stock.underlyingTicker || stock.symbol.replace(/c$/, "");
    const parqetResult = await fetchSafeImage(
      `https://assets.parqet.com/logos/symbol/${encodeURIComponent(ticker)}?format=png`
    );
    if (parqetResult) {
      return new NextResponse(parqetResult.buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": parqetResult.contentType,
          "Cache-Control":
            "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        },
      });
    }
  }

  // 3. Verified Token Catalog (3,100+ Base tokens)
  const verifiedDef =
    findVerifiedToken(lowerAddress) ||
    findVerifiedToken(cleanSymbol) ||
    findVerifiedToken(baseTicker);

  if (verifiedDef?.logoURI) {
    if (verifiedDef.logoURI.startsWith("/tokens/")) {
      const vPath = resolve(process.cwd(), "public", verifiedDef.logoURI.slice(1));
      if (existsSync(vPath)) {
        const fileData = readFileSync(vPath);
        return new NextResponse(fileData, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control":
              "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
          },
        });
      }
    } else if (verifiedDef.logoURI.startsWith("http")) {
      const remoteImg = await fetchSafeImage(verifiedDef.logoURI);
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

  // 4. Check negative cache to avoid hitting external CDNs repeatedly
  const lastNegative = negativeCache.get(lowerAddress);
  if (lastNegative && Date.now() - lastNegative < NEGATIVE_CACHE_TTL_MS) {
    const svg = generateTokenPlaceholderSvg(address, cleanSymbol, 128);
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control":
          "public, max-age=120, s-maxage=120, stale-while-revalidate=120",
      },
    });
  }

  // 5. External Candidate Chain (DexScreener, CoinGecko, Optimism)
  const checksum = isAddress(lowerAddress) ? getAddress(lowerAddress) : lowerAddress;
  const candidates: string[] = [];

  if (KNOWN_REMOTE_LOGOS[lowerAddress]) {
    candidates.push(KNOWN_REMOTE_LOGOS[lowerAddress]);
  }

  if (isAddress(lowerAddress)) {
    candidates.push(`https://dd.dexscreener.com/ds-data/tokens/base/${lowerAddress}.png`);
  }

  if (cleanSymbol && cleanSymbol !== "TK") {
    candidates.push(
      `https://raw.githubusercontent.com/ethereum-optimism/ethereum-optimism.github.io/master/data/${encodeURIComponent(
        cleanSymbol
      )}/logo.png`
    );
    candidates.push(
      `https://assets.parqet.com/logos/symbol/${encodeURIComponent(cleanSymbol)}?format=png`
    );
  }

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

  // 6. Negative Result: Cache for 2m & Return Deterministic Placeholder SVG
  negativeCache.set(lowerAddress, Date.now());
  const fallbackSvg = generateTokenPlaceholderSvg(address, cleanSymbol, 128);
  return new NextResponse(fallbackSvg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=120, s-maxage=120, stale-while-revalidate=120",
    },
  });
}
