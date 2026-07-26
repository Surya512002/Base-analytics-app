"use client";

import { Swords, Share2, Twitter } from "lucide-react";
import { twitterShare, warpcast } from "@/lib/utils/share";
import type { WalletData } from "@/lib/types/wallet";
import { getAppUrl } from "@/lib/constants/app-url";

export default function ChallengePromoCard({
  wallet,
  onChallenge,
}: {
  wallet: WalletData;
  onChallenge: () => void;
}) {
  const challengeUrl = `${getAppUrl()}/?tab=dashboard&challenge=${wallet.address}`;
  const text = `My Base onchain score is ${wallet.score} (${wallet.walletRank}). Beat me: ${challengeUrl}`;

  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
      <p className="section-eyebrow text-[var(--ink-muted)] flex items-center gap-2">
        <Swords size={12} /> Challenge friends
      </p>
      <h3 className="page-hero-title text-lg mt-1">Compare onchain scores</h3>
      <p className="readable-body text-sm mt-2">
        Share your score link — friends connect and see how they stack up on Base.
      </p>
      <div className="flex flex-wrap gap-2 mt-4">
        <button
          type="button"
          onClick={onChallenge}
          className="min-h-[40px] px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] border border-transparent text-[12px] font-bold text-[var(--accent-ink)] transition-colors"
        >
          Challenge a wallet
        </button>
        <button
          type="button"
          onClick={() => warpcast(text)}
          className="min-h-[40px] px-3 rounded-xl border border-white/10 text-[11px] font-bold text-slate-300 flex items-center gap-1"
        >
          <Share2 size={12} /> Farcaster
        </button>
        <button
          type="button"
          onClick={() => twitterShare(text)}
          className="min-h-[40px] px-3 rounded-xl border border-white/10 text-[11px] font-bold text-slate-300 flex items-center gap-1"
        >
          <Twitter size={12} /> X
        </button>
      </div>
    </section>
  );
}
