"use client";

import { useEffect, useState } from "react";
import { fetchTokenPairs } from "@/lib/api/launchpad-token-client";
import { formatUsd } from "@/lib/launchpad/format";

export default function TokenMarketBadge({ address }: { address: string }) {
  const [mc, setMc] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchTokenPairs(address)
      .then((d) => {
        if (!alive) return;
        const best = [...(d.pairs ?? [])].sort(
          (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
        )[0];
        setMc(best?.marketCap ?? best?.fdv ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [address]);

  if (!mc) return null;
  return (
    <span className="text-[10px] font-bold text-emerald-300/90">
      MC {formatUsd(mc)}
    </span>
  );
}
