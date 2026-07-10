"use client";

import { Transaction, TransactionButton } from "@coinbase/onchainkit/transaction";
import { base } from "viem/chains";
import { RefreshCcw } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import VoucherRedeemStatusBanner from "@/components/voucher/VoucherRedeemStatusBanner";
import VoucherCardPreview from "@/components/voucher/VoucherCardPreview";
import type { useVoucherTab } from "@/hooks/useVoucherTab";

type VoucherTab = ReturnType<typeof useVoucherTab>;

export default function VoucherRedeemPanel({
  shared,
  redeem,
}: {
  shared: VoucherTab["shared"];
  redeem: VoucherTab["redeem"];
}) {
  const { contractReady, txCaps, prepareOnchainKitCalls } = shared;
  const {
    redeemCardId,
    setRedeemCardId,
    redeemSecret,
    setRedeemSecret,
    redeemError,
    redeemKey,
    redeemPreview,
    redeemPreviewLoading,
    redeemPreviewRefreshing,
    redeemParsedForTx,
    redeemCall,
    handleRedeemTx,
  } = redeem;

  return (
    <SectionCard>
      <div className="space-y-4">
        <div className="page-hero">
          <p className="section-eyebrow">Redeem voucher</p>
          <p className="readable-body mt-2">
            Enter the Card ID and secret from your gift card to claim funds to your wallet.
          </p>
        </div>

        <div>
          <label className="section-eyebrow">Card ID</label>
          <input
            value={redeemCardId}
            onChange={(e) => setRedeemCardId(e.target.value)}
            placeholder="e.g. 12-3"
            className="w-full mt-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-3 text-white font-mono outline-none focus:border-white/25"
          />
        </div>
        <div>
          <label className="section-eyebrow">Card secret</label>
          <input
            value={redeemSecret}
            onChange={(e) => setRedeemSecret(e.target.value.toUpperCase())}
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
            className="w-full mt-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-3 text-white font-mono tracking-wider outline-none focus:border-white/25"
          />
        </div>

        {redeemError && !redeemPreview?.redeemed && (
          <p className="text-red-400 text-xs font-bold">{redeemError}</p>
        )}

        <VoucherRedeemStatusBanner
          cardId={redeemPreview?.cardId}
          redeemed={redeemPreview?.redeemed}
          loading={redeemPreviewLoading && !redeemPreview}
        />

        {(redeemParsedForTx || redeemPreview) && (
          <div className="relative min-h-[340px] rounded-2xl border border-cyan-500/20 bg-white/[0.02] overflow-hidden">
            {redeemPreviewLoading && !redeemPreview ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCcw size={20} className="animate-spin text-cyan-400/70" />
                <p className="text-sm font-bold">Loading card details…</p>
              </div>
            ) : redeemPreview ? (
              <div
                className={`p-4 transition-opacity duration-200 ${
                  redeemPreviewRefreshing ? "opacity-60" : "opacity-100"
                }`}
              >
                {redeemPreviewRefreshing && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#020812]/40 backdrop-blur-[1px]">
                    <RefreshCcw size={18} className="animate-spin text-cyan-300" />
                  </div>
                )}
                <p className="section-eyebrow mb-3">
                  {redeemPreview.redeemed ? "Card preview (redeemed)" : "Your gift card"}
                </p>
                <VoucherCardPreview
                  cardId={redeemPreview.cardId}
                  asset={redeemPreview.asset}
                  amount={redeemPreview.amountPerCard}
                  message={redeemPreview.message}
                  redeemed={redeemPreview.redeemed}
                  showSecret={false}
                  showRedeemedNotice={false}
                />
              </div>
            ) : null}
          </div>
        )}

        <p className="readable-body text-[10px]">
          You can only redeem <span className="text-cyan-400 font-bold">one card</span> per batch per wallet.
        </p>

        {contractReady && redeemCall.length > 0 && !redeemPreview?.redeemed ? (
          <Transaction
            key={redeemKey}
            chainId={base.id}
            calls={prepareOnchainKitCalls(redeemCall)}
            capabilities={txCaps}
            onStatus={handleRedeemTx}
          >
            <TransactionButton
              className="w-full py-3.5 rounded-xl font-black btn-primary text-white"
              text="Redeem to Wallet"
            />
          </Transaction>
        ) : (
          <button
            disabled
            className={`w-full py-3.5 rounded-xl font-black ${
              redeemPreview?.redeemed
                ? "bg-red-500/15 border border-red-400/40 text-red-200"
                : "bg-white/10 text-slate-600"
            }`}
          >
            {redeemPreviewLoading && !redeemPreview
              ? "Checking card…"
              : redeemPreview?.redeemed
                ? "Already redeemed — cannot claim again"
                : redeemParsedForTx && !redeemSecret.trim()
                  ? "Enter secret key"
                  : "Enter Card ID & Secret"}
          </button>
        )}
      </div>
    </SectionCard>
  );
}
