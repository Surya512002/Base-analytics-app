"use client";

import React, { useEffect, useCallback } from "react";
import {
  RefreshCcw,
  Info,
  Gift,
} from "lucide-react";
import VoucherRedeemStatusBanner from "@/components/voucher/VoucherRedeemStatusBanner";
import { PersonalGiftSender, useSenderIdentity } from "@/components/voucher/SenderPreview";
import GiftClaimStage, { shareGiftOnX } from "@/components/voucher/GiftClaimStage";
import { formatVoucherAmount } from "@/lib/utils/voucher";
import type { RedeemPreview, RedeemSuccess } from "@/components/voucher/voucher-types";
import { parseCurrentUrlClaim } from "@/lib/voucher/claim-link-parser";
import type { useVoucherTab } from "@/hooks/useVoucherTab";

type VoucherTab = ReturnType<typeof useVoucherTab>;

interface VoucherRedeemPanelProps {
  shared: VoucherTab["shared"];
  redeem: VoucherTab["redeem"];
  onNavigateTab?: (tab: string) => void;
  /** Set once a card is claimed: the box opens and shows it. */
  success?: RedeemSuccess | null;
  /** Wallet the gift lands in. */
  claimer?: string;
  onCreateOwn?: () => void;
  onSwapAsset?: () => void;
}

export default function VoucherRedeemPanel({
  shared,
  redeem,
  onNavigateTab: _onNavigateTab,
  success,
  claimer,
  onCreateOwn,
  onSwapAsset,
}: VoucherRedeemPanelProps) {
  const { contractReady } = shared;
  const {
    redeemCardId,
    setRedeemCardId,
    redeemSecret,
    setRedeemSecret,
    redeemError,
    redeemPreview,
    redeemPreviewLoading,
    redeemParsedForTx,
    redeemCall,
    directRedeeming,
    executeDirectRedeem,
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

        {redeemPreview ? (
          <PersonalClaim
            preview={redeemPreview}
            success={success && success.cardId === redeemPreview.cardId ? success : null}
            claiming={directRedeeming}
            canClaim={contractReady && redeemCall.length > 0 && !redeemPreview.redeemed && !redeemError}
            reason={
              redeemPreview.redeemed
                ? "This gift card was already claimed"
                : redeemError
                  ? redeemError
                  : !claimer
                    ? "Connect your wallet to open it"
                    : !redeemSecret.trim()
                      ? "Enter the secret key to unlock it"
                      : undefined
            }
            claimer={claimer}
            onTap={() => void executeDirectRedeem()}
            onCreateOwn={onCreateOwn}
            onSwapAsset={onSwapAsset}
          />
        ) : (
        <>
          {/* No card found yet: checking state, then what to fill in */}
          {redeemParsedForTx && redeemPreviewLoading && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] py-12 flex flex-col items-center justify-center gap-2 text-[var(--ink-muted)]">
              <RefreshCcw size={20} className="animate-spin text-[var(--brand-text)]" />
              <span className="text-xs font-bold">Finding your gift on Base…</span>
            </div>
          )}
          <div className="pt-2">
            <button
              type="button"
              disabled
              className={`w-full py-4 rounded-xl font-black text-sm border transition ${
                redeemError
                  ? "bg-red-500/10 border-red-500/30 text-red-500 cursor-not-allowed"
                  : "bg-[var(--surface-2)] border-[var(--border-subtle)] text-[var(--ink-muted)] cursor-not-allowed"
              }`}
            >
              {redeemPreviewLoading
                ? "Checking card validity…"
                : redeemError
                  ? redeemError
                  : !redeemCardId.trim()
                    ? "Enter Card ID"
                    : !redeemSecret.trim()
                      ? "Enter Secret Key"
                      : "Enter Valid Card ID & Secret"}
            </button>
          </div>
        </>
        )}
      </div>
    </div>
  );
}

/** Personal gift card claim: the tap-to-open box with batch counts, sender and timing. */
function PersonalClaim({
  preview,
  success,
  claiming,
  canClaim,
  reason,
  claimer,
  onTap,
  onCreateOwn,
  onSwapAsset,
}: {
  preview: RedeemPreview;
  success: RedeemSuccess | null;
  claiming: boolean;
  canClaim: boolean;
  reason?: string;
  claimer?: string;
  onTap: () => void;
  onCreateOwn?: () => void;
  onSwapAsset?: () => void;
}) {
  const sender = useSenderIdentity(preview.creator);
  const amountLabel = `${formatVoucherAmount(preview.asset, preview.amountPerCard)} ${preview.asset}`;
  const total = preview.cardCount;
  const left = total != null && preview.redeemedCount != null ? Math.max(0, total - preview.redeemedCount) : undefined;
  return (
    <div className="space-y-4">
      <GiftClaimStage
        status={success ? "opened" : claiming ? "claiming" : canClaim ? "ready" : "unavailable"}
        statusText={claiming ? "Confirm in your wallet…" : reason}
        amountLabel={amountLabel}
        message={preview.message}
        sender={sender}
        left={left}
        total={left != null ? total : undefined}
        unlockAt={preview.unlockAt || undefined}
        expiresAt={preview.expiresAt || undefined}
        claimer={claimer}
        txHash={success?.txHash}
        onTap={onTap}
        onShare={() => shareGiftOnX(amountLabel)}
        onCreateOwn={onCreateOwn}
        onSwap={onSwapAsset}
      />
      {preview.creator && <PersonalGiftSender creator={preview.creator} />}
    </div>
  );
}
