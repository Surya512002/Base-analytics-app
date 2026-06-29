"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Gift, Wallet, ArrowRight } from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";
import PrismScene from "@/components/ui/PrismScene";
import VoucherGiftCard3D from "@/components/wallet/VoucherGiftCard3D";
import { APP_URL_WEB } from "@/lib/constants/env";
import { buildRedeemFarcasterUrl } from "@/lib/utils/voucher-share";

function RedeemLandingContent() {
  const searchParams = useSearchParams();
  const cardFromUrl = searchParams.get("card") || "";
  const [cardId, setCardId] = useState(cardFromUrl);
  const [preview, setPreview] = useState<{
    asset: string;
    amountPerCard: string;
    message: string;
    redeemed: boolean;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (cardFromUrl) setCardId(cardFromUrl);
  }, [cardFromUrl]);

  useEffect(() => {
    const id = cardId.trim();
    if (!id || !/^\d+-\d+$/.test(id)) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    fetch(`/api/voucher/card-preview?card=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPreview(d))
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [cardId]);

  const appRedeemUrl = cardId.trim()
    ? `${APP_URL_WEB}/?tab=voucher&card=${encodeURIComponent(cardId.trim())}`
    : `${APP_URL_WEB}/?tab=voucher`;

  return (
    <div className="min-h-screen bg-[#040a14] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora pointer-events-none" />
      <PrismScene dense />
      <div className="absolute inset-0 bg-grid-future opacity-25 pointer-events-none" />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-12 sm:py-16">
        <div className="flex items-center gap-3 mb-10">
          <AppLogo size="md" />
          <span className="font-black text-lg tracking-[0.15em] uppercase">Base Analytics</span>
        </div>

        <div className="hero-card rounded-3xl p-6 sm:p-8 space-y-6 card-shimmer tab-content-enter">
          <div className="flex flex-col sm:flex-row gap-6 items-center">
            <div className="flex-1 w-full space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
              <Gift size={24} className="text-cyan-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                Base Voucher
              </p>
              <h1 className="text-2xl font-black text-white">Redeem your gift card</h1>
            </div>
          </div>

          <p className="text-sm text-slate-400 leading-relaxed">
            Enter the Card ID and secret you received. Connect your wallet on Base to claim ETH or
            USDC — fully onchain.
          </p>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Card ID</label>
            <input
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              placeholder="e.g. 12-3"
              className="w-full mt-1.5 bg-white/[0.05] border border-white/12 rounded-xl px-4 py-3.5 text-white font-mono outline-none focus:border-violet-500/40"
            />
          </div>

          {previewLoading && (
            <p className="text-xs text-slate-500 animate-pulse">Looking up card on Base…</p>
          )}
          {preview && !previewLoading && (
            <div className={`rounded-2xl border p-4 ${preview.redeemed ? "border-red-500/30 bg-red-500/10" : "border-emerald-500/30 bg-emerald-500/8"}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Card preview</p>
              <p className="text-2xl font-black text-white mt-1">
                {preview.asset === "USDC"
                  ? `$${(Number(preview.amountPerCard) / 1e6).toFixed(2)}`
                  : `${(Number(preview.amountPerCard) / 1e18).toFixed(4)} ETH`}
              </p>
              {preview.message && (
                <p className="text-sm text-slate-300 italic mt-2">&quot;{preview.message}&quot;</p>
              )}
              <p className={`text-xs font-bold mt-2 ${preview.redeemed ? "text-red-300" : "text-emerald-400"}`}>
                {preview.redeemed ? "Already redeemed onchain" : "Ready to claim — connect wallet below"}
              </p>
            </div>
          )}

          <Link
            href={appRedeemUrl}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-black btn-primary text-white"
          >
            <Wallet size={18} />
            Connect & Redeem
            <ArrowRight size={16} />
          </Link>

          <p className="text-center text-[10px] text-slate-500">
            You&apos;ll need the secret key in the app after connecting.
          </p>
            </div>
            <div className="shrink-0 card-tilt-3d animate-float hidden sm:block">
              <VoucherGiftCard3D asset="USDC" compact showStack animated />
            </div>
          </div>
        </div>

        <div className="mt-8 text-center space-y-3">
          <p className="text-sm text-slate-400">
            Want to send gift cards instead?{" "}
            <Link href={`${APP_URL_WEB}/?tab=voucher`} className="text-cyan-400 font-bold hover:underline">
              Create vouchers →
            </Link>
          </p>
          <Link href={APP_URL_WEB} className="text-xs text-slate-500 hover:text-slate-300">
            ← Back to Base Analytics
          </Link>
          <a
            href={buildRedeemFarcasterUrl(cardId.trim() || undefined)}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-violet-400 hover:text-violet-300 font-bold"
          >
            Share redeem link on Farcaster ↗
          </a>
        </div>
      </div>
    </div>
  );
}

export default function RedeemPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#040a14] flex items-center justify-center text-slate-500">
          Loading…
        </div>
      }
    >
      <RedeemLandingContent />
    </Suspense>
  );
}
