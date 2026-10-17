"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Rocket,
  ArrowRight,
  Share2,
  Twitter,
  Lock,
  Coins,
} from "lucide-react";
import Link from "next/link";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { basescanTxUrl } from "@/lib/utils/tx";
import TokenAvatar from "@/components/ui/TokenAvatar";

interface LaunchSuccessPanelProps {
  token: LaunchedToken;
  onTrade: () => void;
  onExplore?: () => void;
  onCopied?: () => void;
}

export default function LaunchSuccessPanel({
  token,
  onTrade,
  onExplore: _onExplore,
  onCopied,
}: LaunchSuccessPanelProps) {
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const txUrl = basescanTxUrl(token.txHash);
  const tokenBasescanUrl = `https://basescan.org/address/${token.address}`;

  const swapPageUrl = `/swap?buy=${token.address}`;

  const copyAddress = async () => {
    const ok = await copyToClipboard(token.address);
    if (ok) {
      setCopiedAddr(true);
      onCopied?.();
      setTimeout(() => setCopiedAddr(false), 2000);
    }
  };

  const copyShareLink = async () => {
    const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/explore/token/${token.address}` : "";
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const tweetText = encodeURIComponent(
    `🚀 Just launched $${token.symbol} on @base!\n\n` +
    `Trade directly with instant creator revenue sharing on Base Analytics:\n`
  );
  const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(
    typeof window !== "undefined" ? `${window.location.origin}/explore/token/${token.address}` : ""
  )}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-meridian-fade">
      {/* Success Badge & Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/20 shadow-xs">
          <CheckCircle2 size={32} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[var(--ink)] tracking-tight">
          ${token.symbol} is Live on Base!
        </h1>
        <p className="text-sm text-[var(--ink-muted)]">
          {token.name} has been successfully deployed to Base mainnet.
        </p>
      </div>

      {/* Main Success Card */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <TokenAvatar
            src={token.imageUrl}
            address={token.address}
            symbol={token.symbol}
            className="w-20 h-20 rounded-2xl shadow-xs"
            textClassName="text-2xl font-black"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <h2 className="text-xl font-black text-[var(--ink)]">{token.name}</h2>
              <span className="font-mono text-sm font-bold text-[#0052FF]">${token.symbol}</span>
            </div>
            {token.description && (
              <p className="text-xs text-[var(--ink-muted)] line-clamp-2 leading-relaxed">
                {token.description}
              </p>
            )}

            {/* Contract Address Bar with Copy */}
            <div className="pt-2">
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--ink)] select-all break-all">
                <span>{token.address}</span>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="p-1.5 rounded-lg text-[#0052FF] hover:bg-[var(--surface)] transition shrink-0 cursor-pointer"
                  title="Copy contract address"
                >
                  <Copy size={14} />
                </button>
              </div>
              {copiedAddr && (
                <p className="text-[11px] text-emerald-600 font-bold mt-1 text-right">
                  Contract address copied to clipboard!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Links & Verification Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--border-subtle)]/60 text-xs">
          <a
            href={tokenBasescanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[var(--ink-muted)] hover:text-[#0052FF] font-medium"
          >
            <span>View on BaseScan</span>
            <ExternalLink size={12} />
          </a>

          {token.liquidityLocked && (
            <div className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <Lock size={12} />
              <span>OpenLaunch Locker Proof</span>
            </div>
          )}

          {txUrl && (
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[var(--ink-muted)] hover:text-[#0052FF] font-medium"
            >
              <span>Deployment Tx</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Action Buttons: Token Page + Swap Page */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onTrade}
            className="py-3 px-4 rounded-xl bg-[#0052FF] text-white hover:bg-[#0047e0] font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <span>Open Token Page</span>
            <ArrowRight size={14} />
          </button>

          <Link
            href={swapPageUrl}
            className="pop-pill py-3 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] hover:border-[#0052FF] hover:text-[#0052FF] font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Coins size={14} />
            <span>Trade on Swap Page</span>
          </Link>
        </div>

        {/* Social Share Buttons */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pop-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs font-bold text-[var(--ink)] hover:text-[#0052FF] transition cursor-pointer"
          >
            <Twitter size={13} />
            <span>Share on X</span>
          </a>

          <button
            type="button"
            onClick={copyShareLink}
            className="pop-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs font-bold text-[var(--ink)] hover:text-[#0052FF] transition cursor-pointer"
          >
            <Share2 size={13} />
            <span>{copiedShare ? "Link Copied!" : "Copy Share Link"}</span>
          </button>
        </div>
      </div>

      {/* Short "Next Steps" Checklist */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-[var(--ink)]">
          Next Steps for Creators
        </h3>
        <ul className="text-xs text-[var(--ink-muted)] space-y-2">
          <li className="pop p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] flex items-start gap-2">
            <span className="font-bold text-[#0052FF]">1.</span>
            <span>
              <strong>Share your token link</strong> with your community on X, Farcaster, and Telegram so traders can swap with low slippage.
            </span>
          </li>
          <li className="pop p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] flex items-start gap-2">
            <span className="font-bold text-[#0052FF]">2.</span>
            <span>
              <strong>Check your Creator Profile</strong> to track trading volume, total market cap, and accumulated 0.25% revenue share in ETH.
            </span>
          </li>
          <li className="pop p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] flex items-start gap-2">
            <span className="font-bold text-[#0052FF]">3.</span>
            <span>
              <strong>Add additional pool liquidity</strong> if you wish to deepen trading support on Aerodrome or Uniswap V3.
            </span>
          </li>
        </ul>

        <div className="pt-2 text-right">
          <Link
            href="/profile"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#0052FF] hover:underline"
          >
            Go to Creator Profile <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}
