"use client";

import React from "react";
import { Check } from "lucide-react";

export interface VerifiedBadgeProps {
  size?: number;
  className?: string;
  title?: string;
  showTooltip?: boolean;
}

/**
 * Coinbase Wallet-style Verified Blue Checkmark Badge
 *
 * Displays an authentic blue tick indicator next to verified tokens on Base
 * (matching Coinbase Wallet curated lists, Base official bridge, and B20 equities).
 */
export default function VerifiedBadge({
  size = 14,
  className = "",
  title = "Verified by Coinbase Wallet · Base Mainnet Asset",
  showTooltip = true,
}: VerifiedBadgeProps) {
  const iconSize = Math.max(8, Math.round(size * 0.65));

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-[#0052FF] text-white shrink-0 select-none shadow-xs transition-transform hover:scale-110 ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
      }}
      title={showTooltip ? title : undefined}
      aria-label="Verified asset"
    >
      <Check
        size={iconSize}
        strokeWidth={3.5}
        className="text-white shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]"
      />
    </span>
  );
}
