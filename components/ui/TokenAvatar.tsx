"use client";

import React, { useState, useEffect, useMemo } from "react";
import { tokenLogoFallbackUrl } from "@/lib/launchpad/token-logo";

interface TokenAvatarProps {
  src?: string | null;
  address?: string | null;
  symbol: string;
  className?: string;
  textClassName?: string;
  alt?: string;
}

export default function TokenAvatar({
  src,
  address,
  symbol,
  className = "w-10 h-10 rounded-xl",
  textClassName = "text-xs",
  alt = "",
}: TokenAvatarProps) {
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Reset failure counter if src or address changes
  useEffect(() => {
    setFailedAttempts(0);
  }, [src, address]);

  const displaySrc = useMemo(() => {
    if (failedAttempts === 0 && src?.trim()) {
      return src.trim();
    }
    if (failedAttempts === 1 && address?.trim()) {
      return tokenLogoFallbackUrl(address);
    }
    return null;
  }, [src, address, failedAttempts]);

  const initials = useMemo(() => {
    const clean = (symbol || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return clean.slice(0, 3) || "TOK";
  }, [symbol]);

  if (!displaySrc || failedAttempts >= 2) {
    return (
      <div
        className={`${className} bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center font-mono font-black text-[var(--ink)] shrink-0 select-none ${textClassName}`}
        aria-label={symbol}
      >
        {initials}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      alt={alt || symbol}
      loading="lazy"
      decoding="async"
      className={`${className} object-cover border border-[var(--border-subtle)] shrink-0 bg-[var(--surface-2)]`}
      onError={() => {
        setFailedAttempts((prev) => prev + 1);
      }}
    />
  );
}
