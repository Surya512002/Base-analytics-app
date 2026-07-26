"use client";

import { ExternalLink } from "lucide-react";
import { dexScreenerEmbedUrl, dexScreenerPageUrl } from "@/lib/launchpad/dexscreener-embed";
import TokenPriceChart from "@/components/launchpad/TokenPriceChart";
import type { RecentSwapRow } from "@/lib/api/launchpad-token-client";

export default function TokenChartPanel({
  pairAddress,
  tokenAddress,
  swaps,
  swapsLoading,
}: {
  pairAddress?: string | null;
  tokenAddress: string;
  swaps: RecentSwapRow[];
  swapsLoading?: boolean;
}) {
  if (pairAddress) {
    const embed = dexScreenerEmbedUrl(pairAddress);
    const page = dexScreenerPageUrl(tokenAddress);

    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/[0.02]">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Live chart · DexScreener
            </p>
            <a
              href={page}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold text-[var(--ink)] hover:text-white inline-flex items-center gap-1"
            >
              Open full <ExternalLink size={10} />
            </a>
          </div>
          <iframe
            title="Token price chart"
            src={embed}
            className="w-full h-[420px] sm:h-[480px] border-0 bg-[#0a0f18]"
            allow="clipboard-write"
            loading="lazy"
          />
        </div>
        <p className="text-[10px] text-slate-600 text-center">
          Chart data by DexScreener · 15m candles
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <TokenPriceChart swaps={swaps} loading={swapsLoading} />
      <p className="text-[10px] text-slate-600 text-center">
        No pool indexed yet — showing swap-derived price when available
      </p>
    </div>
  );
}
