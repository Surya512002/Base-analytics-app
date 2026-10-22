"use client";

import React from "react";
import TokenLogo from "./TokenLogo";

export interface TokenAvatarProps {
  src?: string | null;
  address?: string | null;
  symbol: string;
  className?: string;
  textClassName?: string;
  alt?: string;
}

/**
 * TokenAvatar backwards-compatibility adapter routing to the unified TokenLogo component.
 */
export default function TokenAvatar({
  src,
  address,
  symbol,
  className = "w-10 h-10 rounded-xl",
  alt,
}: TokenAvatarProps) {
  return (
    <TokenLogo
      address={address}
      symbol={symbol}
      src={src}
      alt={alt}
      className={className}
      shape="rounded-xl"
    />
  );
}
