"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  getDeterministicTokenColor,
  getDeterministicTokenInitials,
} from "@/lib/utils/token-color";
import {
  getTokenizedStockByAddress,
  getTokenizedStockBySymbol,
} from "@/lib/stocks/tokenized-stocks-registry";
import { COMMON_BASE_TOKENS } from "@/lib/launchpad/common-tokens";
import { SELF_HOSTED_LOGOS } from "@/lib/launchpad/token-logo";
import { getVerifiedTokenLogo, findVerifiedToken } from "@/lib/swap/verified-tokens";
import { isAddress } from "viem";

export interface TokenLogoProps {
  address?: string | null;
  symbol?: string | null;
  size?: number | string;
  src?: string | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  shape?: "circle" | "rounded-xl" | "rounded-lg" | "rounded-full" | "auto";
  onError?: () => void;
}

/** Well-known Base token remote CDN logos */
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
 * Standardized, bulletproof TokenLogo component.
 * Fallback chain:
 * 1. Self-hosted local PNG in /tokens/<effectiveAddress>.png (0ms latency, zero CDN fail)
 * 2. Explicit src / registry logo
 * 3. Verified token catalog logos (3,100+ Base tokens from CoinGecko/Superchain)
 * 4. DexScreener Base CDN
 * 5. Parqet stock CDN
 * 6. Server-side proxy & cache (/api/token-logo/<effectiveAddress>)
 * 7. Deterministic HSL avatar badge (never blank, never shifts layout)
 */
export default function TokenLogo({
  address,
  symbol = "TK",
  size = 32,
  src,
  alt,
  className = "",
  style,
  shape = "circle",
  onError,
}: TokenLogoProps) {
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Clean symbol: strip leading dollar signs and trim
  const rawSymbol = (symbol || "TK").trim();
  const cleanSymbol = rawSymbol.replace(/^\$/, "").trim() || "TK";
  // Extract base ticker for compound symbols (e.g. "NVDAc-USDC" -> "NVDAc", "WETH/USDC" -> "WETH")
  const baseTicker = cleanSymbol.split(/[-/_ ]/)[0] || cleanSymbol;

  // Stock resolution from symbol or baseTicker
  const stockInfo = useMemo(() => {
    try {
      if (address) {
        const byAddr = getTokenizedStockByAddress(address.trim().toLowerCase());
        if (byAddr) return byAddr;
      }
      return (
        getTokenizedStockBySymbol(cleanSymbol) ||
        getTokenizedStockBySymbol(baseTicker) ||
        getTokenizedStockBySymbol(`${cleanSymbol}c`) ||
        getTokenizedStockBySymbol(`${baseTicker}c`) ||
        getTokenizedStockBySymbol(cleanSymbol.replace(/c$/i, "")) ||
        getTokenizedStockBySymbol(baseTicker.replace(/c$/i, "")) ||
        null
      );
    } catch {
      return null;
    }
  }, [address, cleanSymbol, baseTicker]);

  // Bidirectional resolution: Normalize address or look up by symbol/ticker
  const effectiveAddress = useMemo(() => {
    if (address) {
      const trimmed = address.trim().toLowerCase();
      if (trimmed === "eth" || trimmed === "0x0000000000000000000000000000000000000000") {
        return "0x0000000000000000000000000000000000000000";
      }
      // If address is in SELF_HOSTED_LOGOS or known stock, use it directly
      if (SELF_HOSTED_LOGOS.has(trimmed) || trimmed.startsWith("0xb200000000000000000000")) {
        return trimmed;
      }
      // If address is an unrecognized vault/pool address, but stock or verified token matches ticker:
      if (stockInfo) {
        return stockInfo.address.toLowerCase();
      }
      const vTok = findVerifiedToken(cleanSymbol) || findVerifiedToken(baseTicker);
      if (vTok && !isAddress(trimmed)) {
        return vTok.address.toLowerCase();
      }
      return trimmed;
    }

    // Address missing: resolve from symbol
    if (cleanSymbol.toUpperCase() === "ETH" || baseTicker.toUpperCase() === "ETH") {
      return "0x0000000000000000000000000000000000000000";
    }

    if (stockInfo) return stockInfo.address.toLowerCase();

    try {
      const verified = findVerifiedToken(cleanSymbol) || findVerifiedToken(baseTicker);
      if (verified) return verified.address.toLowerCase();

      const common = COMMON_BASE_TOKENS.find(
        (t) =>
          t.symbol.toLowerCase() === cleanSymbol.toLowerCase() ||
          t.symbol.toLowerCase() === baseTicker.toLowerCase()
      );
      if (common) return common.address.toLowerCase();
    } catch {
      // ignore
    }

    return null;
  }, [address, cleanSymbol, baseTicker, stockInfo]);

  // Registry stock logo lookup if available
  const registryLogo = useMemo(() => {
    try {
      if (stockInfo?.logo) return stockInfo.logo;
      if (effectiveAddress) {
        const stock = getTokenizedStockByAddress(effectiveAddress);
        if (stock?.logo) return stock.logo;
      }
      return null;
    } catch {
      return null;
    }
  }, [effectiveAddress, stockInfo]);

  // Verified catalog logo (3,108 Base tokens)
  const verifiedCatalogLogo = useMemo(() => {
    try {
      if (effectiveAddress) {
        const l = getVerifiedTokenLogo(effectiveAddress);
        if (l) return l;
      }
      const bySym = getVerifiedTokenLogo(cleanSymbol) || getVerifiedTokenLogo(baseTicker);
      if (bySym) return bySym;
      return null;
    } catch {
      return null;
    }
  }, [effectiveAddress, cleanSymbol, baseTicker]);

  // Reset attempt index when address or src changes
  useEffect(() => {
    setAttemptIndex(0);
    setLoaded(false);
  }, [src, effectiveAddress]);

  // Construct candidate URLs in priority order
  const candidateUrls = useMemo(() => {
    const list: string[] = [];

    // Helper: Push if valid and not already added
    const add = (url: string | null | undefined) => {
      if (!url || typeof url !== "string") return;
      const u = url.trim();
      if (!u || u.startsWith("/stocks/")) return;
      if (!list.includes(u)) {
        list.push(u);
      }
    };

    // 1. If self-hosted or stock, local /tokens/<effectiveAddress>.png is fastest (0ms)
    if (
      effectiveAddress &&
      (SELF_HOSTED_LOGOS.has(effectiveAddress) ||
        effectiveAddress.startsWith("0xb200000000000000000000") ||
        effectiveAddress === "0x0000000000000000000000000000000000000000" ||
        Boolean(stockInfo))
    ) {
      add(`/tokens/${effectiveAddress}.png`);
    }

    // 2. Explicit src (skip known broken /stocks/ patterns)
    add(src);

    // 3. Registry logo (e.g. https://metadata.coinbase.com/equity_icons/... or /tokens/...)
    add(registryLogo);

    // 4. Verified catalog logo (CoinGecko / Superchain)
    add(verifiedCatalogLogo);

    if (effectiveAddress) {
      // 5. Known remote CDN logos
      if (KNOWN_REMOTE_LOGOS[effectiveAddress]) {
        add(KNOWN_REMOTE_LOGOS[effectiveAddress]);
      }

      // 6. DexScreener CDN for Base tokens
      add(`https://dd.dexscreener.com/ds-data/tokens/base/${effectiveAddress}.png`);

      // 7. Parqet stock CDN candidate
      if (stockInfo) {
        const ticker = stockInfo.underlyingTicker || stockInfo.symbol.replace(/c$/, "");
        add(`https://assets.parqet.com/logos/symbol/${encodeURIComponent(ticker)}?format=png`);
        if (ticker.includes(".")) {
          add(`https://assets.parqet.com/logos/symbol/${encodeURIComponent(ticker.replace(".", "-"))}?format=png`);
        }
      }

      // 8. Local self-hosted fallback
      add(`/tokens/${effectiveAddress}.png`);

      // 9. Server-side proxy & cache (/api/token-logo/<effectiveAddress>)
      add(
        `/api/token-logo/${effectiveAddress}?symbol=${encodeURIComponent(cleanSymbol)}`
      );
    } else {
      // Address unknown, try proxy by symbol
      add(`/api/token-logo/unknown?symbol=${encodeURIComponent(cleanSymbol)}`);
    }

    return list;
  }, [src, registryLogo, verifiedCatalogLogo, effectiveAddress, cleanSymbol, stockInfo]);

  const currentSrc = attemptIndex < candidateUrls.length ? candidateUrls[attemptIndex] : null;

  // Immediate detection for cached images
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [currentSrc]);

  // Compute fixed dimensions ONLY if className does not specify w- or h-
  const hasCustomSize = /\b[wh]-\d+|\b[wh]-\[/.test(className);
  const pixelSize = typeof size === "number" ? size : parseInt(String(size), 10) || 32;
  const dimensionStyle: React.CSSProperties = hasCustomSize
    ? { ...style }
    : {
        width: pixelSize,
        height: pixelSize,
        minWidth: pixelSize,
        minHeight: pixelSize,
        ...style,
      };

  const roundedClass =
    shape === "rounded-xl"
      ? "rounded-xl"
      : shape === "rounded-lg"
      ? "rounded-lg"
      : "rounded-full";

  const altText = alt || `${cleanSymbol} logo`;

  // Deterministic fallback color & initials
  const palette = useMemo(
    () => getDeterministicTokenColor(effectiveAddress || cleanSymbol),
    [effectiveAddress, cleanSymbol]
  );
  const initials = useMemo(
    () => getDeterministicTokenInitials(cleanSymbol),
    [cleanSymbol]
  );

  const fontSize = Math.max(10, Math.round(pixelSize * 0.38));

  // If no candidate URLs exist or all attempts failed, render deterministic placeholder badge
  if (!currentSrc) {
    return (
      <div
        className={`${roundedClass} shrink-0 aspect-square flex items-center justify-center font-mono font-black select-none text-white border transition-colors shadow-xs ${className}`.trim()}
        style={{
          ...dimensionStyle,
          background: palette.gradient,
          borderColor: palette.border,
          fontSize: `${fontSize}px`,
        }}
        aria-label={altText}
        role="img"
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 aspect-square overflow-hidden ${roundedClass} bg-[var(--surface-2)] dark:bg-white/[0.08] dark:ring-1 dark:ring-white/10 ${className}`.trim()}
      style={dimensionStyle}
    >
      {/* Fallback Initials Badge rendered underneath img */}
      <div
        className={`absolute inset-0 flex items-center justify-center font-mono font-bold select-none text-white ${roundedClass} transition-opacity duration-150 ${
          loaded ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={{
          background: palette.gradient,
          fontSize: `${fontSize}px`,
        }}
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Main Image with key to force fresh mount upon fallback transition */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={currentSrc}
        ref={(el) => {
          imgRef.current = el;
          if (el?.complete && el.naturalWidth > 0) {
            setLoaded(true);
          }
        }}
        src={currentSrc}
        alt={altText}
        decoding="async"
        className={`relative z-10 w-full h-full object-cover shrink-0 ${roundedClass} border border-[var(--border-subtle)] bg-transparent transition-opacity duration-150 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setAttemptIndex((prev) => prev + 1);
          setLoaded(false);
          onError?.();
        }}
      />
    </div>
  );
}
