"use client";

import React from "react";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import TokenLogo from "@/components/ui/TokenLogo";

export default function TokenIcon({
  counter,
  size = 28,
  className = "",
}: {
  counter: SwapCounter;
  size?: number;
  className?: string;
}) {
  const isEth = counter.kind === "eth";
  const symbol = isEth ? "ETH" : counter.symbol;
  const address = isEth ? "eth" : counter.address;
  const src = isEth
    ? "/tokens/0x0000000000000000000000000000000000000000.png"
    : counter.imageUrl;

  return (
    <TokenLogo
      address={address}
      symbol={symbol}
      src={src}
      size={size}
      className={className}
      shape="circle"
    />
  );
}
