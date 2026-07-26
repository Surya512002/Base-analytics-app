"use client";

import { useState } from "react";
import { CheckCircle2, Copy, ExternalLink, Rocket } from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { aerodromeDepositUrl, uniswapPoolUrl } from "@/lib/launchpad/dex";
import { basescanTxUrl } from "@/lib/utils/tx";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { isInvalidLaunchTokenAddress } from "@/lib/b20/launch-receipt";

export default function LaunchSuccessPanel({
  token,
  onTrade,
  onExplore,
  onCopied,
}: {
  token: LaunchedToken;
  onTrade: () => void;
  onExplore: () => void;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const txUrl = basescanTxUrl(token.txHash);
  const tokenUrl = `https://basescan.org/address/${token.address}`;
  const addressLooksWrong = isInvalidLaunchTokenAddress(token.address);

  const copyAddr = async () => {
    const ok = await copyToClipboard(token.address);
    if (ok) {
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 2500);
    }
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
        <div className="h-0.5 bg-[var(--bg-raised)]" />
        <div className="p-6 flex flex-col sm:flex-row gap-5 items-center sm:items-start">
          <div className="w-24 h-24 rounded-2xl border border-white/10 bg-white/[0.06] overflow-hidden shrink-0 flex items-center justify-center">
            {token.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={token.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Rocket className="text-[var(--ink-muted)]" size={32} />
            )}
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <p className="font-black text-white text-xl">{token.name}</p>
            <p className="text-[var(--ink-muted)] font-bold text-lg">${token.symbol}</p>
            {token.description && (
              <p className="text-sm text-slate-400 mt-2">{token.description}</p>
            )}
            <div className="mt-3 space-y-2">
              {addressLooksWrong && (
                <p className="text-[11px] text-amber-300/90 leading-relaxed">
                  Address preview unavailable — open your launch tx on BaseScan and copy the new
                  token address from the <span className="font-semibold">B20Created</span> event.
                </p>
              )}
              <p
                className="font-mono text-xs sm:text-sm text-white break-all select-all leading-relaxed rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
                title={token.address}
              >
                {token.address}
              </p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => void copyAddr()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] text-slate-300 hover:text-white"
                >
                  <Copy size={12} />
                  {copied ? "Copied!" : "Copy contract address"}
                </button>
                <a
                  href={tokenUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] text-[var(--ink)] hover:text-white"
                >
                  Token on BaseScan <ExternalLink size={12} />
                </a>
                {txUrl && (
                  <a
                    href={txUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] text-slate-400 hover:text-white"
                  >
                    Launch tx <ExternalLink size={12} />
                  </a>
                )}
              </div>
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
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            Add on Uniswap <ExternalLink size={12} />
          </a>
          <a
            href={aerodromeDepositUrl(token.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            Add on Aerodrome <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}
