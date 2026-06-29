"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Gift, Trophy, Zap } from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";
import PrismScene from "@/components/ui/PrismScene";
import { APP_URL_WEB } from "@/lib/constants/env";
import { formatDexVolumeUsd } from "@/lib/utils/swap-volume";

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
    dexVolumeUSD30d: number;
    portfolioValueUSD: number;
  };
}

function WalletProfileContent() {
  const params = useParams();
  const raw = (params.address as string) || "";
  const address = raw.startsWith("0x") && raw.length === 42 ? raw.toLowerCase() : null;
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(`/api/analyze-wallet?address=${encodeURIComponent(address)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setData({ wallet: d.wallet }))
      .catch(() => setError("Could not load wallet profile."))
      .finally(() => setLoading(false));
  }, [address]);

  if (!address) {
    return <p className="text-slate-500 text-center py-20">Invalid address.</p>;
  }

  const w = data?.wallet;

  return (
    <div className="min-h-screen bg-[#03080f] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora pointer-events-none" />
      <PrismScene />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        <Link href={APP_URL_WEB} className="flex items-center gap-2 mb-10 text-slate-400 hover:text-white text-sm">
          <AppLogo size="sm" /> Base Analytics
        </Link>

        <div className="elegant-panel rounded-3xl border border-violet-500/25 overflow-hidden card-shimmer tab-content-enter">
          <div className="h-0.5 bg-linear-to-r from-champagne via-violet-500 to-cyan-400" />
          <div className="p-6 sm:p-8">
            {loading && <p className="text-slate-500 animate-pulse">Scanning onchain profile…</p>}
            {error && <p className="text-red-400">{error}</p>}
            {w && (
              <>
                <p className="section-eyebrow">Public profile</p>
                <h1 className="text-2xl sm:text-3xl font-black text-white mt-2 break-all">
                  {w.basename || `${w.address.slice(0, 10)}…${w.address.slice(-6)}`}
                </h1>
                <p className="text-sm text-violet-300 font-bold mt-1">{w.walletRank}</p>
                <p className="text-5xl font-black text-gradient-prism mt-4">{w.score}</p>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Onchain score</p>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  {[
                    { l: "Transactions", v: w.txCount.toLocaleString() },
                    { l: "Active days", v: String(w.uniqueDays) },
                    { l: "NFTs", v: String(w.nftCount) },
                    { l: "Paymaster txs", v: String(w.paymasterTxCount) },
                    { l: "DEX 30d", v: formatDexVolumeUsd(w.dexVolumeUSD30d) },
                    { l: "Portfolio", v: w.portfolioValueUSD > 0 ? `$${w.portfolioValueUSD.toFixed(0)}` : "—" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-xl bg-white/[0.04] border border-white/8 p-3">
                      <p className="text-lg font-black text-white">{s.v}</p>
                      <p className="text-[9px] text-slate-500 uppercase font-bold">{s.l}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 mt-8">
                  <Link
                    href={`${APP_URL_WEB}/?tab=voucher`}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl btn-primary font-black text-sm"
                  >
                    <Gift size={16} /> Send a voucher
                  </Link>
                  <Link
                    href={`/pay/${w.address}`}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/10 border border-white/15 font-black text-sm"
                  >
                    <Zap size={16} /> Pay link
                  </Link>
                </div>
                <Link
                  href={`${APP_URL_WEB}/?tab=dashboard&challenge=${w.address}`}
                  className="flex items-center justify-center gap-2 mt-3 text-sm text-cyan-400 font-bold hover:underline"
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
    <Suspense fallback={<div className="min-h-screen bg-[#03080f] flex items-center justify-center text-slate-500">Loading…</div>}>
      <WalletProfileContent />
    </Suspense>
  );
}
