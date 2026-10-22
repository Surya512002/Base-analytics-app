"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  getDeterministicTokenColor,
  getDeterministicTokenInitials,
} from "@/lib/utils/token-color";
import { getTokenizedStockByAddress } from "@/lib/stocks/tokenized-stocks-registry";

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

/**
 * Standardized, bulletproof TokenLogo component.
 * Fallback chain:
 * 1. Explicit src / token metadata / registry logo
 * 2. Self-hosted local logo (/tokens/<address>.png)
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

  // Normalize address & key
  const normalizedAddress = useMemo(() => {
    if (!address) return null;
    const trimmed = address.trim().toLowerCase();
    if (trimmed === "eth" || trimmed === "0x0000000000000000000000000000000000000000") {
      return "0x0000000000000000000000000000000000000000";
    }
    return trimmed;
  }, [address]);

  // Reset attempt index when address or src changes
  useEffect(() => {
    setAttemptIndex(0);
    setLoaded(false);
  }, [src, normalizedAddress]);

  // Registry stock logo lookup if available
  const registryLogo = useMemo(() => {
    if (!normalizedAddress) return null;
    try {
      const stock = getTokenizedStockByAddress(normalizedAddress);
      return stock?.logo || null;
    } catch {
      return null;
    }
  }, [normalizedAddress]);

  // Construct candidate URLs in priority order
  const candidateUrls = useMemo(() => {
    const list: string[] = [];

    // a) Registry or explicit token metadata logo
    if (src && src.trim()) {
      list.push(src.trim());
    } else if (registryLogo) {
      list.push(registryLogo);
    }

    if (normalizedAddress) {
      // b) Self-hosted logos in /tokens/<address>.png
      list.push(`/tokens/${normalizedAddress}.png`);

      // c & d) Proxy server route which resolves official token lists & DEX info with CDN caching
      list.push(
        `/api/token-logo/${normalizedAddress}?symbol=${encodeURIComponent(
          symbol || "TK"
        )}`
      );
    }

    // Deduplicate preserving order
    return Array.from(new Set(list));
  }, [src, registryLogo, normalizedAddress, symbol]);

  const currentSrc = attemptIndex < candidateUrls.length ? candidateUrls[attemptIndex] : null;

  // Compute fixed dimensions
  const pixelSize = typeof size === "number" ? size : parseInt(size, 10) || 32;
  const dimensionStyle: React.CSSProperties = {
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

  const cleanSymbol = symbol || "TK";
  const altText = alt || `${cleanSymbol} logo`;

  // Deterministic fallback color & initials
  const palette = useMemo(
    () => getDeterministicTokenColor(normalizedAddress || cleanSymbol),
    [normalizedAddress, cleanSymbol]
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
      {/* Loading Skeleton Shimmer */}
      {!loaded && (
        <div
          className={`absolute inset-0 bg-[var(--surface-2)] animate-pulse ${roundedClass} flex items-center justify-center font-mono font-bold text-xs opacity-70`}
          style={{
            background: palette.gradient,
            borderColor: palette.border,
            fontSize: `${fontSize}px`,
          }}
          aria-hidden="true"
        >
          {initials}
        </div>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currentSrc}
        alt={altText}
        loading="lazy"
        decoding="async"
        className={`w-full h-full object-cover shrink-0 ${roundedClass} border border-[var(--border-subtle)] bg-[var(--surface-2)] dark:bg-white/[0.06] transition-opacity duration-150 ${
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
