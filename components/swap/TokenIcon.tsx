"use client";

import { useMemo, useState } from "react";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import {
  ETH_LOGO_URL,
  tokenLogoFallbackUrl,
  tokenLogoUrl,
} from "@/lib/launchpad/token-logo";

export default function TokenIcon({
  counter,
  size = 28,
  className = "",
}: {
  counter: SwapCounter;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(0);

  const symbol = counter.kind === "eth" ? "ETH" : counter.symbol;
  const primarySrc = useMemo(() => {
    if (counter.kind === "eth") return ETH_LOGO_URL;
    return counter.imageUrl ?? tokenLogoUrl(counter.address);
  }, [counter]);

  const src = useMemo(() => {
    if (failed === 0) return primarySrc;
    if (failed === 1 && counter.kind === "token") {
      return tokenLogoFallbackUrl(counter.address);
    }
    return null;
  }, [counter, failed, primarySrc]);

  const style = { width: size, height: size };

  if (!src || failed >= 2) {
    return (
      <span
        className={`swap-eth-icon ${className}`.trim()}
        style={style}
        aria-hidden
      >
        {symbol.slice(0, 2)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={`rounded-full object-cover border border-white/10 shrink-0 bg-[#1a1a1a] ${className}`.trim()}
      style={style}
      onError={() => setFailed((n) => n + 1)}
    />
  );
}
