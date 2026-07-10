"use client";

import { CheckCircle2, Copy, ExternalLink, Rocket } from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { aerodromeDepositUrl, uniswapPoolUrl } from "@/lib/launchpad/dex";
import { basescanTxUrl } from "@/lib/utils/tx";

export default function LaunchSuccessPanel({
  token,
  onTrade,
  onExplore,
}: {
  token: LaunchedToken;
  onTrade: () => void;
  onExplore: () => void;
}) {
  const txUrl = basescanTxUrl(token.txHash);
  const copyAddr = () => {
    void navigator.clipboard.writeText(token.address);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/20 mb-3">
          <CheckCircle2 className="text-emerald-400" size={28} />
        </div>
        <h2 className="text-2xl font-black text-white">${token.symbol} is live</h2>
        <p className="text-sm text-slate-400 mt-1">{token.name} deployed on Base</p>
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden border border-emerald-500/20">
        <div className="h-0.5 bg-linear-to-r from-emerald-500 to-[#0052FF]" />
        <div className="p-6 flex flex-col sm:flex-row gap-5 items-center sm:items-start">
          <div className="w-24 h-24 rounded-2xl border border-white/10 bg-white/[0.06] overflow-hidden shrink-0 flex items-center justify-center">
            {token.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={token.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Rocket className="text-[#6BA3FF]" size={32} />
            )}
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <p className="font-black text-white text-xl">{token.name}</p>
            <p className="text-[#6BA3FF] font-bold text-lg">${token.symbol}</p>
            {token.description && (
              <p className="text-sm text-slate-400 mt-2">{token.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
              <button
                type="button"
                onClick={copyAddr}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] text-slate-300 hover:text-white"
              >
                <Copy size={12} />
                {token.address.slice(0, 10)}…{token.address.slice(-8)}
              </button>
              {txUrl && (
                <a
                  href={txUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] text-[#6BA3FF] hover:text-white"
                >
                  BaseScan <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onTrade}
          className="py-3.5 rounded-xl font-black text-sm bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          Trade ${token.symbol}
        </button>
        <button
          type="button"
          onClick={onExplore}
          className="py-3.5 rounded-xl font-black text-sm bg-white/[0.06] border border-white/10 text-white hover:bg-white/[0.1]"
        >
          Back to explore
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <p className="text-center text-[11px] text-slate-400">
          Add WETH liquidity to enable swaps in the Trade panel. Auto mode picks the best quote
          between Uniswap and Aerodrome.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <a
            href={uniswapPoolUrl(token.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-[11px] font-bold text-cyan-300 hover:text-white"
          >
            Add on Uniswap <ExternalLink size={12} />
          </a>
          <a
            href={aerodromeDepositUrl(token.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-[11px] font-bold text-cyan-300 hover:text-white"
          >
            Add on Aerodrome <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}
