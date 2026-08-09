"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Gift, Share2, Trophy, Twitter, Zap } from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";
import QuickGiftCta from "@/components/voucher/QuickGiftCta";
import { APP_URL_WEB } from "@/lib/constants/env";
import { getAppUrl } from "@/lib/constants/app-url";
import { formatDexVolumeUsd } from "@/lib/utils/swap-volume";
import { twitterShare, warpcast } from "@/lib/utils/share";
import { fetchOwnedBadges, type OwnedBadge } from "@/lib/wallet/owned-badges";

interface ProfileData {
  wallet: {
    address: string;
    basename: string | null;
    score: number;
    walletRank: string;
    txCount: number;
    uniqueDays: number;
    nftCount: number;
    paymasterTxCount: number;
    aaTxCount?: number;
    dexVolumeUSD30d: number;
    portfolioValueUSD: number;
  };
}

function WalletProfileContent() {
  const params = useParams();
  const raw = (params.address as string) || "";
  const address = raw.startsWith("0x") && raw.length === 42 ? raw.toLowerCase() : null;
  const [data, setData] = useState<ProfileData | null>(null);
  const [badges, setBadges] = useState<OwnedBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/analyze-wallet?address=${encodeURIComponent(address)}`).then((r) =>
        r.ok ? r.json() : Promise.reject()
      ),
      fetchOwnedBadges(address).catch(() => [] as OwnedBadge[]),
    ])
      .then(([d, owned]) => {
        setData({ wallet: d.wallet });
        setBadges(owned.slice(0, 6));
      })
      .catch(() => setError("Could not load wallet profile."))
      .finally(() => setLoading(false));
  }, [address]);

  if (!address) {
    return <p className="text-[var(--ink-dim)] text-center py-20">Invalid address.</p>;
  }

  const w = data?.wallet;
  const shareUrl = `${getAppUrl()}/wallet/${address}`;
  const shareText = w
    ? `Onchain score ${w.score} (${w.walletRank}) on Base — ${shareUrl}`
    : shareUrl;

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--ink)] relative overflow-hidden">
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        <Link href={APP_URL_WEB} className="flex items-center gap-2 mb-10 text-[var(--ink-muted)] hover:text-[var(--ink)] text-sm">
          <AppLogo size="sm" /> Base Analytics
        </Link>

        <div className="elegant-panel rounded-3xl border border-[var(--border-subtle)] overflow-hidden card-shimmer tab-content-enter">
          <div className="p-6 sm:p-8">
            {loading && <p className="text-[var(--ink-dim)] animate-pulse">Scanning onchain profile…</p>}
            {error && <p className="text-red-400">{error}</p>}
            {w && (
              <>
                <p className="section-eyebrow">Public profile</p>
                <h1 className="text-2xl sm:text-3xl font-black text-[var(--ink)] mt-2 break-all">
                  {w.basename || `${w.address.slice(0, 10)}…${w.address.slice(-6)}`}
                </h1>
                <p className="text-sm text-[var(--ink-muted)] font-bold mt-1">{w.walletRank}</p>
                <p className="text-5xl font-black text-[var(--ink)] mt-4">{w.score}</p>
                <p className="text-xs text-[var(--ink-dim)] uppercase tracking-widest font-bold">Onchain score</p>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  {[
                    { l: "Transactions", v: w.txCount.toLocaleString() },
                    { l: "Active days", v: String(w.uniqueDays) },
                    { l: "AA txs", v: String(w.aaTxCount ?? 0) },
                    { l: "Base App / gasless", v: String(w.paymasterTxCount) },
                    { l: "NFTs", v: String(w.nftCount) },
                    { l: "DEX 30d", v: formatDexVolumeUsd(w.dexVolumeUSD30d) },
                    { l: "Portfolio", v: w.portfolioValueUSD > 0 ? `$${w.portfolioValueUSD.toFixed(0)}` : "—" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3">
                      <p className="text-lg font-black text-[var(--ink)]">{s.v}</p>
                      <p className="text-[9px] text-[var(--ink-dim)] uppercase font-bold">{s.l}</p>
                    </div>
                  ))}
                </div>

                {badges.length > 0 && (
                  <div className="mt-6">
                    <p className="section-eyebrow mb-2 flex items-center gap-1">
                      <Trophy size={12} /> Badges
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {badges.map((b) => (
                        <span
                          key={b.tokenId}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--ink)]"
                        >
                          <span>{b.tierIcon}</span> {b.tierName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <QuickGiftCta recipientAddress={w.address} compact />

                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => warpcast(shareText)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--ink-muted)]"
                  >
                    <Share2 size={12} /> Farcaster
                  </button>
                  <button
                    type="button"
                    onClick={() => twitterShare(shareText)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--ink-muted)]"
                  >
                    <Twitter size={12} /> Share score
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <Link
                    href={`${APP_URL_WEB}/?tab=basehub&create=1&asset=USDC&total=5&cards=1`}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl btn-primary font-black text-sm"
                  >
                    <Gift size={16} /> Send a voucher
                  </Link>
                  <Link
                    href={`/pay/${w.address}`}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-black text-sm"
                  >
                    <Zap size={16} /> Pay link
                  </Link>
                </div>
                <Link
                  href={`${APP_URL_WEB}/?tab=dashboard&challenge=${w.address}`}
                  className="flex items-center justify-center gap-2 mt-3 text-sm text-[var(--ink)] font-bold hover:underline"
                >
                  Challenge this wallet <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WalletProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center text-[var(--ink-dim)]">Loading…</div>}>
      <WalletProfileContent />
    </Suspense>
  );
}
