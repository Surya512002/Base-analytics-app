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
import { getAddress, isAddress } from "viem";

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
 * 1. Explicit src / registry logo / self-hosted PNG in /tokens/<address>.png
 * 2. TrustWallet & Smoldapp Base token asset lists
 * 3. Server-side proxy & cache (/api/token-logo/<address>)
 * 4. Deterministic HSL avatar badge (never blank, never shifts layout)
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

  const cleanSymbol = (symbol || "TK").trim();

  // Bidirectional resolution: Normalize address or look up by symbol
  const effectiveAddress = useMemo(() => {
    if (address) {
      const trimmed = address.trim().toLowerCase();
      if (trimmed === "eth" || trimmed === "0x0000000000000000000000000000000000000000") {
        return "0x0000000000000000000000000000000000000000";
      }
      return trimmed;
    }

    // Address missing: resolve from symbol
    if (cleanSymbol.toUpperCase() === "ETH") {
      return "0x0000000000000000000000000000000000000000";
    }

    try {
      const stock =
        getTokenizedStockBySymbol(cleanSymbol) ||
        getTokenizedStockBySymbol(`${cleanSymbol}c`) ||
        getTokenizedStockBySymbol(cleanSymbol.replace(/c$/i, ""));
      if (stock) return stock.address.toLowerCase();

      const common = COMMON_BASE_TOKENS.find(
        (t) => t.symbol.toLowerCase() === cleanSymbol.toLowerCase()
      );
      if (common) return common.address.toLowerCase();
    } catch {
      // ignore
    }

    return null;
  }, [address, cleanSymbol]);

  // Registry stock logo lookup if available
  const registryLogo = useMemo(() => {
    try {
      if (effectiveAddress) {
        const stock = getTokenizedStockByAddress(effectiveAddress);
        if (stock?.logo) return stock.logo;
      }
      const stockBySym =
        getTokenizedStockBySymbol(cleanSymbol) ||
        getTokenizedStockBySymbol(`${cleanSymbol}c`) ||
        getTokenizedStockBySymbol(cleanSymbol.replace(/c$/i, ""));
      return stockBySym?.logo || null;
    } catch {
      return null;
    }
  }, [effectiveAddress, cleanSymbol]);

  // Reset attempt index when address or src changes
  useEffect(() => {
    setAttemptIndex(0);
    setLoaded(false);
  }, [src, effectiveAddress]);

  // Construct candidate URLs in priority order
  const candidateUrls = useMemo(() => {
    const list: string[] = [];

    // 1. Explicit src (skip known broken /stocks/ patterns)
    if (src && src.trim()) {
      const cleanSrc = src.trim();
      if (!cleanSrc.startsWith("/stocks/")) {
        list.push(cleanSrc);
      }
    }

    // 2. Registry logo (e.g. /tokens/0xb2000....png)
    if (registryLogo) {
      list.push(registryLogo);
    }

    if (effectiveAddress) {
      // 3. Self-hosted local logo in /tokens/<effectiveAddress>.png
      if (
        SELF_HOSTED_LOGOS.has(effectiveAddress) ||
        effectiveAddress.startsWith("0xb200000000000000000000") ||
        effectiveAddress === "0x0000000000000000000000000000000000000000"
      ) {
        list.push(`/tokens/${effectiveAddress}.png`);
      }

      // 4. Known remote CDN logos (CoinGecko)
      if (KNOWN_REMOTE_LOGOS[effectiveAddress]) {
        list.push(KNOWN_REMOTE_LOGOS[effectiveAddress]);
      }

      // 5. TrustWallet Base asset list
      if (isAddress(effectiveAddress)) {
        const checksum = getAddress(effectiveAddress);
        list.push(
          `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${checksum}/logo.png`
        );
        list.push(
          `https://assets.smold.app/api/token/8453/${checksum}/logo-128.png`
        );
      }

      // 6. Generic self-hosted fallback
      list.push(`/tokens/${effectiveAddress}.png`);

      // 7. Server-side proxy & cache (/api/token-logo/<effectiveAddress>)
      list.push(
        `/api/token-logo/${effectiveAddress}?symbol=${encodeURIComponent(cleanSymbol)}`
      );
    }

    // Deduplicate preserving order
    return Array.from(new Set(list));
  }, [src, registryLogo, effectiveAddress, cleanSymbol]);

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

      {/* Main Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
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
