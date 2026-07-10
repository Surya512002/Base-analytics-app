"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Rocket } from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import { fetchLaunchpadTokens } from "@/lib/api/launchpad-client";
import { fetchMarketData } from "@/lib/api/launchpad-market-client";
import TokenCard from "@/components/launchpad/TokenCard";
import { formatUsd, shortAddr } from "@/lib/launchpad/format";

export default function CreatorProfilePanel({
  address,
  onOpenToken,
}: {
  address: string;
  onOpenToken?: (token: LaunchedToken) => void;
}) {
  const [tokens, setTokens] = useState<LaunchedToken[]>([]);
  const [markets, setMarkets] = useState<Record<string, TokenMarketSummary>>({});
  const [loading, setLoading] = useState(true);

  const creator = address.toLowerCase();

  useEffect(() => {
    void Promise.all([fetchLaunchpadTokens(), fetchMarketData()])
      .then(([data, marketData]) => {
        setTokens(data.tokens.filter((t) => t.creator.toLowerCase() === creator));
        setMarkets(marketData.markets);
      })
      .finally(() => setLoading(false));
  }, [creator]);

  const stats = useMemo(() => {
    let totalVol = 0;
    let totalMcap = 0;
    for (const t of tokens) {
      const m = markets[t.address.toLowerCase()];
      totalVol += m?.volume24h ?? 0;
      totalMcap += m?.marketCap ?? 0;
    }
    return { launches: tokens.length, totalVol, totalMcap };
  }, [tokens, markets]);

  if (loading) {
    return <div className="h-64 rounded-3xl bg-white/[0.03] animate-pulse" />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="rounded-3xl border border-[#0052FF]/25 bg-linear-to-br from-[#0052FF]/10 to-black/40 p-6 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6BA3FF] mb-2">
          Creator profile
        </p>
        <h1 className="text-2xl sm:text-3xl font-black text-white font-mono">
          {shortAddr(address, 8, 6)}
        </h1>
        <div className="flex flex-wrap gap-6 mt-6 text-sm">
          <div>
            <p className="text-slate-500 text-[10px] font-black uppercase">Launches</p>
            <p className="text-2xl font-black text-white">{stats.launches}</p>
          </div>
          <div>
            <p className="text-slate-500 text-[10px] font-black uppercase">24h volume</p>
            <p className="text-2xl font-black text-white font-mono">
              {stats.totalVol > 0 ? formatUsd(stats.totalVol) : "—"}
            </p>
          </div>
          <div>
            <p className="text-slate-500 text-[10px] font-black uppercase">Total mcap</p>
            <p className="text-2xl font-black text-white font-mono">
              {stats.totalMcap > 0 ? formatUsd(stats.totalMcap) : "—"}
            </p>
          </div>
        </div>
        <a
          href={`https://basescan.org/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold text-[#6BA3FF] hover:text-white"
        >
          View on BaseScan <ExternalLink size={12} />
        </a>
      </div>

      {tokens.length === 0 ? (
        <p className="text-center text-slate-500 py-12">No launches from this creator yet.</p>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Rocket size={16} className="text-[#6BA3FF]" />
            <h2 className="text-lg font-black text-white">Launched tokens</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokens.map((t) => (
              <TokenCard
                key={t.address}
                token={t}
                market={markets[t.address.toLowerCase()]}
                onTrade={() =>
                  onOpenToken
                    ? onOpenToken(t)
                    : (window.location.href = `/explore/token/${t.address}`)
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
