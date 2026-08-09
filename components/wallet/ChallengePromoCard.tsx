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
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--ink-muted)] flex items-center gap-2">
        <Swords size={12} /> Challenge friends
      </p>
      <h3 className="text-lg font-black text-[var(--ink)] mt-1 tracking-tight">
        Compare onchain scores
      </h3>
      <p className="text-sm text-[var(--ink-muted)] mt-2 leading-relaxed">
        Share your score link — friends connect and see how they stack up on Base.
      </p>
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button
          type="button"
          onClick={onChallenge}
          className="min-h-[40px] px-4 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] border border-transparent text-[12px] font-bold text-[var(--accent-ink)] transition-colors"
        >
          Challenge a wallet
        </button>
        <button
          type="button"
          onClick={() => warpcast(text)}
          className="min-h-[40px] px-1 text-[12px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center gap-1.5"
        >
          <Share2 size={13} /> Farcaster
        </button>
        <button
          type="button"
          onClick={() => twitterShare(text)}
          className="min-h-[40px] px-1 text-[12px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center gap-1.5"
        >
          <Twitter size={13} /> X
        </button>
      </div>
    </section>
  );
}
