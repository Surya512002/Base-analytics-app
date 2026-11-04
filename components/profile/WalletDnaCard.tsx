"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Share2, Sparkles, Copy, Check, Dna, Flame } from "lucide-react";
import { fetchNeynar } from "@/lib/api/neynar";
import { shortAddr } from "@/lib/launchpad/format";
import Image from "next/image";

interface WalletDnaCardProps {
  address: string;
  streak?: number;
  activeDays?: number;
  txCount?: number;
  volumeUsd?: number;
}

export default function WalletDnaCard({
  address,
  streak = 7,
  activeDays = 42,
  txCount = 128,
  volumeUsd = 12500,
}: WalletDnaCardProps) {
  const [farcasterUser, setFarcasterUser] = useState<{
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch Neynar Farcaster Identity
  useEffect(() => {
    let alive = true;
    if (!address) return;

    fetchNeynar("v2/farcaster/user/bulk-by-address", { addresses: address.toLowerCase() })
      .then((res) => {
        if (!alive || !res.ok) return;
        const users = res.data?.[address.toLowerCase()] as Array<{
          username?: string;
          display_name?: string;
          pfp_url?: string;
        }>;
        if (users && users.length > 0) {
          setFarcasterUser({
            username: users[0].username,
            displayName: users[0].display_name,
            pfpUrl: users[0].pfp_url,
          });
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [address]);

  const origin = useMemo(() => {
    if (typeof window !== "undefined") return window.location.origin;
    return "https://base-analytics-app.vercel.app";
  }, []);

  const ogImageUrl = useMemo(() => {
    const qs = new URLSearchParams({
      address,
      streak: String(streak),
      activeDays: String(activeDays),
      txs: String(txCount),
      days: String(activeDays),
    });
    return `${origin}/api/og?${qs.toString()}`;
  }, [address, streak, activeDays, txCount, origin]);

  const shareText = `Check out my verified onchain activity on @base: ${activeDays} active days, ${txCount} transactions, and a ${streak}-day streak! 🔵⚡`;

  const warpcastShareUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(
    shareText
  )}&embeds[]=${encodeURIComponent(ogImageUrl)}`;

  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareText
  )}&url=${encodeURIComponent(ogImageUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(ogImageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 space-y-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <Dna size={22} />
          </div>
          <div>
            <h3 className="text-base font-black text-[var(--ink)] flex items-center gap-2">
              <span>Wallet DNA Card</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0052FF] text-white">
                Base Onchain
              </span>
            </h3>
            <p className="text-xs text-[var(--ink-muted)]">
              Dynamic shareable proof of onchain activity
            </p>
          </div>
        </div>

        {farcasterUser?.username && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-600 dark:text-purple-400 font-bold">
            {farcasterUser.pfpUrl && (
              <Image
                src={farcasterUser.pfpUrl}
                alt=""
                width={18}
                height={18}
                unoptimized
                className="w-4.5 h-4.5 rounded-full"
              />
            )}
            <span>@{farcasterUser.username}</span>
          </div>
        )}
      </div>

      {/* Visual Card Preview */}
      <div className="relative rounded-2xl border border-[var(--border-strong)] bg-gradient-to-br from-[#0052FF]/15 via-[var(--surface-2)] to-purple-600/10 p-5 space-y-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[var(--ink-muted)]">
              Daily Streak
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-mono font-black text-[var(--ink)] flex items-center gap-1.5">
                <Flame size={26} className="text-amber-500 fill-amber-500/20 inline" />
                {streak}
              </span>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">days</span>
            </div>
            <span className="inline-block mt-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Onchain Verified
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[var(--ink-muted)]">
              Wallet
            </span>
            <p className="font-mono text-xs font-bold text-[var(--ink)] mt-0.5">{shortAddr(address)}</p>
            <p className="text-[10px] text-[var(--ink-dim)] mt-1">Base Mainnet</p>
          </div>
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-subtle)]/60 text-xs">
          <div className="p-2 rounded-xl bg-[var(--surface)]/70 border border-[var(--border-subtle)] text-center">
            <span className="text-[10px] text-[var(--ink-muted)] block">Active Days</span>
            <span className="font-mono font-bold text-[var(--ink)]">{activeDays}</span>
          </div>
          <div className="p-2 rounded-xl bg-[var(--surface)]/70 border border-[var(--border-subtle)] text-center">
            <span className="text-[10px] text-[var(--ink-muted)] block">Total Txs</span>
            <span className="font-mono font-bold text-[var(--ink)]">{txCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-[var(--surface)]/70 border border-[var(--border-subtle)] text-center">
            <span className="text-[10px] text-[var(--ink-muted)] block">DEX Volume</span>
            <span className="font-mono font-bold text-[var(--ink)]">${(volumeUsd / 1000).toFixed(1)}k</span>
          </div>
        </div>
      </div>

      {/* Share Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={warpcastShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="pop-pill flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition shadow-sm cursor-pointer"
        >
          <Sparkles size={14} />
          <span>Share to Warpcast</span>
        </a>

        <a
          href={twitterShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="pop-pill flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition shadow-sm cursor-pointer"
        >
          <Share2 size={14} />
          <span>Share on X</span>
        </a>

        <button
          type="button"
          onClick={handleCopyLink}
          className="pop-pill inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink)] hover:bg-[var(--surface-3)] transition cursor-pointer"
          title="Copy Image URL"
        >
          {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          <span>{copied ? "Copied" : "Copy Link"}</span>
        </button>
      </div>
    </div>
  );
}
