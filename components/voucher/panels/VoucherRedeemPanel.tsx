"use client";

import React, { useEffect, useCallback } from "react";
import { Transaction, TransactionButton } from "@coinbase/onchainkit/transaction";
import { base } from "viem/chains";
import {
  RefreshCcw,
  CheckCircle2,
  ExternalLink,
  Info,
  Gift,
  ArrowRight,
  Wallet,
  ArrowLeftRight,
} from "lucide-react";
import VoucherRedeemStatusBanner from "@/components/voucher/VoucherRedeemStatusBanner";
import VoucherCardPreview from "@/components/voucher/VoucherCardPreview";
import { formatVoucherAmount } from "@/lib/utils/voucher";
import { parseCurrentUrlClaim } from "@/lib/voucher/claim-link-parser";
import type { useVoucherTab } from "@/hooks/useVoucherTab";

type VoucherTab = ReturnType<typeof useVoucherTab>;

interface VoucherRedeemPanelProps {
  shared: VoucherTab["shared"];
  redeem: VoucherTab["redeem"];
  onNavigateTab?: (tab: string) => void;
}

export default function VoucherRedeemPanel({
  shared,
  redeem,
  onNavigateTab,
}: VoucherRedeemPanelProps) {
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

  // Auto-fill from URL fragment, query param, or localStorage via unified parser
  const parseUrlParams = useCallback(() => {
    if (typeof window === "undefined") return;
    const { cardId, secret } = parseCurrentUrlClaim();

    if (cardId && cardId !== redeemCardId) {
      setRedeemCardId(cardId);
    }
    if (secret && secret !== redeemSecret) {
      setRedeemSecret(secret);
    }
  }, [redeemCardId, redeemSecret, setRedeemCardId, setRedeemSecret]);

  useEffect(() => {
    parseUrlParams();
    window.addEventListener("hashchange", parseUrlParams);
    return () => window.removeEventListener("hashchange", parseUrlParams);
  }, [parseUrlParams]);

  const isFormFilled = Boolean(redeemCardId.trim() && redeemSecret.trim());
  const isInvalidFormat = Boolean(
    redeemCardId.trim() && !/^\d+-\d+$/.test(redeemCardId.trim())
  );

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Hero / Explanation */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center font-bold">
            <Gift size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black text-[var(--ink)]">
              Redeem Gift Card
            </h2>
            <p className="text-xs text-[var(--ink-muted)] mt-0.5">
              Claim onchain stocks, USDC, or ETH directly to your connected Base wallet.
            </p>
          </div>
        </div>

        {/* Visible Info Banner: 1 card per wallet per batch rule */}
        <div className="mt-4 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-soft)] p-3.5 flex items-start gap-2.5">
          <Info size={18} className="text-[var(--brand-text)] shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <p className="font-black text-[var(--ink)]">
              One card per wallet per batch rule
            </p>
            <p className="text-[var(--ink-muted)] mt-0.5">
              A wallet can only claim one card from each gift batch. If your wallet already redeemed a card in this batch, redemption will be blocked.
            </p>
          </div>
        </div>
      </div>

      {/* Input Form & Preview */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 shadow-sm space-y-4">
        {/* Card ID Input */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)] block mb-1.5">
            Card ID
          </label>
          <input
            type="text"
            value={redeemCardId}
            onChange={(e) => setRedeemCardId(e.target.value.trim())}
            placeholder="e.g. 12-0"
            className="w-full text-base font-mono font-bold rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--brand-text)] transition"
          />
          {isInvalidFormat && (
            <p className="text-red-500 text-xs font-bold mt-1">
              Card ID must be in format batchId-cardIndex (e.g. 12-0)
            </p>
          )}
        </div>

        {/* Card Secret Input with Paste shortcut */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)] block mb-1.5">
            Card Secret
          </label>
          <div className="relative">
            <input
              type="text"
              value={redeemSecret}
              onChange={(e) => setRedeemSecret(e.target.value.toUpperCase())}
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              className="w-full text-base font-mono tracking-wider rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] px-4 py-3 pr-20 text-[var(--ink)] outline-none focus:border-[var(--brand-text)] transition"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text) setRedeemSecret(text.trim().toUpperCase());
                } catch {
                  /* clipboard access denied */
                }
              }}
              className="pop-pill absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-bold rounded-lg bg-[var(--surface)] text-[var(--brand-text)] border border-[var(--border-subtle)] hover:bg-[var(--border-subtle)]/50 transition cursor-pointer"
            >
              Paste
            </button>
          </div>
        </div>

        {/* Error message */}
        {redeemError && !redeemPreview?.redeemed && (
          <p className="text-red-500 text-xs font-bold bg-red-500/10 border border-red-500/25 rounded-xl p-3">
            {redeemError}
          </p>
        )}

        <VoucherRedeemStatusBanner
          cardId={redeemPreview?.cardId}
          redeemed={redeemPreview?.redeemed}
          loading={redeemPreviewLoading && !redeemPreview}
        />

        {/* Live Card Preview if card ID or preview is active */}
        {(redeemParsedForTx || redeemPreview) && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 relative overflow-hidden">
            {redeemPreviewLoading && !redeemPreview ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-[var(--ink-muted)]">
                <RefreshCcw size={20} className="animate-spin text-[var(--brand-text)]" />
                <span className="text-xs font-bold">Verifying card on Base…</span>
              </div>
            ) : redeemPreview ? (
              <div
                className={`transition-opacity duration-200 ${
                  redeemPreviewRefreshing ? "opacity-60" : "opacity-100"
                }`}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--ink-muted)]">
                    Gift Card Contents
                  </span>
                  {redeemPreview.redeemed && (
                    <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                      Already Redeemed
                    </span>
                  )}
                </div>

                <VoucherCardPreview
                  cardId={redeemPreview.cardId}
                  asset={redeemPreview.asset}
                  amount={redeemPreview.amountPerCard}
                  message={redeemPreview.message}
                  redeemed={redeemPreview.redeemed}
                  showSecret={false}
                  showRedeemedNotice={redeemPreview.redeemed}
                  compact
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Single Primary Action Button */}
        <div className="pt-2">
          {contractReady && redeemCall.length > 0 && !redeemPreview?.redeemed ? (
            <Transaction
              key={redeemKey}
              chainId={base.id}
              calls={prepareOnchainKitCalls(redeemCall)}
              capabilities={txCaps}
              onStatus={handleRedeemTx}
            >
              <TransactionButton
                className="w-full py-4 rounded-xl font-black text-sm bg-[var(--brand)] text-white hover:opacity-90 active:scale-[0.98] transition shadow-md"
                text="Claim to Wallet"
              />
            </Transaction>
          ) : (
            <button
              type="button"
              disabled
              className={`w-full py-4 rounded-xl font-black text-sm border transition ${
                redeemPreview?.redeemed
                  ? "bg-red-500/10 border-red-500/30 text-red-500 cursor-not-allowed"
                  : "bg-[var(--surface-2)] border-[var(--border-subtle)] text-[var(--ink-muted)] cursor-not-allowed"
              }`}
            >
              {redeemPreviewLoading && !redeemPreview
                ? "Checking card validity…"
                : redeemPreview?.redeemed
                  ? "Card Already Redeemed"
                  : !redeemCardId.trim()
                    ? "Enter Card ID"
                    : !redeemSecret.trim()
                      ? "Enter Secret Key"
                      : "Enter Valid Card ID & Secret"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
