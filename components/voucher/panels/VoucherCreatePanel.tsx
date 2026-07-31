"use client";

import { Transaction, TransactionButton } from "@coinbase/onchainkit/transaction";
import { base } from "viem/chains";
import { CheckCircle, Copy, Share2 } from "lucide-react";
import { MAX_VOUCHER_CARDS } from "@/lib/utils/voucher";
import {
  formatSplitSummary,
  formatVoucherAmount,
  formatCardShareText,
  formatBatchShareText,
} from "@/lib/utils/voucher";
import { VOUCHER_TEMPLATES } from "@/lib/constants/voucher-templates";
import SectionCard from "@/components/ui/SectionCard";
import VoucherGiftCard3D from "@/components/wallet/VoucherGiftCard3D";
import VoucherSecurityNotice from "@/components/wallet/VoucherSecurityNotice";
import VoucherCredentialCard from "@/components/wallet/VoucherCredentialCard";
import VoucherSharePanel from "@/components/wallet/VoucherSharePanel";
import type { useVoucherTab } from "@/hooks/useVoucherTab";

type VoucherTab = ReturnType<typeof useVoucherTab>;

export default function VoucherCreatePanel({
  shared,
  create,
}: {
  shared: VoucherTab["shared"];
  create: VoucherTab["create"];
}) {
  const { contractReady, copied, copyText, shareText, txCaps, prepareOnchainKitCalls } = shared;
  const {
    asset,
    setAsset,
    totalAmount,
    setTotalAmount,
    cardCountInput,
    setCardCountInput,
    message,
    setMessage,
    creating,
    pendingCards,
    readyBatchOnCreate,
    activePresets,
    activePresetKey,
    split,
    perCardWei,
    cardCount,
    prepareCreate,
    cancelPendingCreate,
    pendingAsset,
    exactDepositLabel,
    needsUsdcApproval,
    confirmingDeposit,
    createEthCall,
    approveUsdcCall,
    createUsdcCall,
    checkingAllowance,
    usdcAllowanceError,
    usdcReadyToFund,
    usdcTxKey,
    refreshUsdcAllowance,
    handleApproveTx,
    handleFundTx,
    createdSectionRef,
    displayCardsForBatch,
    batchCardStatuses,
    isCardRedeemed,
    isCardStatusKnown,
    mineStatusesLoading,
    loadingBatchDetail,
  } = create;

  return (
    <SectionCard>
      <div className="space-y-4">
        <div className="page-hero">
          <p className="section-eyebrow">Create gift batch</p>
          <p className="readable-body mt-2">
            Split USDC or ETH into shareable gift cards. Each recipient redeems with a unique Card ID and secret.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(["USDC", "ETH"] as const).map((a) => (
            <button
              key={a}
              type="button"
              disabled={!!pendingCards}
              onClick={() => !pendingCards && setAsset(a)}
              className={`py-3 rounded-xl font-bold text-sm border transition ${
                asset === a
                  ? "bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-dark)]"
                  : "bg-[var(--surface-2)] border-[var(--border-subtle)] text-[var(--ink-muted)]"
              } ${pendingCards ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {a}
            </button>
          ))}
        </div>

        <div>
          <p className="section-eyebrow mb-2">Occasion templates</p>
          <div className="flex flex-wrap gap-2">
            {VOUCHER_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setAsset(t.asset);
                  setTotalAmount(t.total);
                  setCardCountInput(t.cards);
                  setMessage(t.message);
                }}
                className="preset-chip rounded-full px-3 py-2 text-[10px] font-bold"
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="section-eyebrow mb-2">Quick presets</p>
          <div className="flex flex-wrap gap-2">
            {activePresets.map((p) => {
              const key = `${p.total}:${p.cards}`;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTotalAmount(p.total);
                    setCardCountInput(p.cards);
                  }}
                  className={`preset-chip rounded-full px-4 py-2 text-xs font-bold ${
                    activePresetKey === key ? "preset-chip-active" : ""
                  }`}
                >
                  {p.label}
                  <span className="text-[9px] font-bold opacity-70 ml-1">
                    · {p.cards} card{p.cards !== "1" ? "s" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="section-eyebrow">
            Total deposit ({asset === "USDC" ? "USD" : "ETH"})
          </label>
          <input
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder={asset === "ETH" ? "0.01" : "10"}
            className="w-full mt-1 input-ink rounded-xl px-3 py-3 font-bold outline-none"
          />
          <p className="readable-body text-[10px] mt-1">
            e.g. {asset === "USDC" ? "$10 USDC" : "0.01 ETH"} split into {cardCountInput || "…"} cards
          </p>
        </div>

        <div>
          <label className="section-eyebrow">
            Number of cards (max {MAX_VOUCHER_CARDS})
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={cardCountInput}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setCardCountInput("");
                return;
              }
              if (!/^\d+$/.test(raw)) return;
              const n = parseInt(raw, 10);
              if (n > MAX_VOUCHER_CARDS) return;
              setCardCountInput(raw);
            }}
            onBlur={() => {
              const n = parseInt(cardCountInput, 10);
              if (!cardCountInput || !Number.isFinite(n) || n < 1) {
                setCardCountInput("1");
              } else if (n > MAX_VOUCHER_CARDS) {
                setCardCountInput(String(MAX_VOUCHER_CARDS));
              } else {
                setCardCountInput(String(n));
              }
            }}
            placeholder="1"
            className="w-full mt-1 input-ink rounded-xl px-3 py-3 font-bold outline-none"
          />
        </div>

        {split && (
          <div
            className={`rounded-2xl p-4 border ${
              split.valid
                ? "glass-panel-accent border-[var(--border-subtle)]"
                : "bg-orange-500/8 border-orange-500/30"
            }`}
          >
            <p className="section-eyebrow mb-3">Split breakdown</p>
            {split.valid ? (
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div>
                  <p className="text-[9px] font-bold text-[var(--ink-muted)] uppercase">Total</p>
                  <p className="text-sm font-black text-[var(--ink)] mt-0.5">
                    {formatVoucherAmount(asset, split.total)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-[var(--ink-muted)] uppercase">Cards</p>
                  <p className="text-sm font-black text-[var(--ink)] mt-0.5">{split.cardCount}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-[var(--ink-muted)] uppercase">Per card</p>
                  <p className="text-sm font-black text-emerald-600 mt-0.5">
                    {formatVoucherAmount(asset, split.perCard)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-700 font-bold mb-3">
                {formatVoucherAmount(asset, split.total)} cannot split evenly into {cardCount} cards.
                Adjust the total or card count so each card holds an equal amount.
              </p>
            )}
            {split.valid && (
              <>
                <p className="readable-body text-xs text-center">
                  {formatSplitSummary(split)}
                </p>
                <div className="mt-4 flex justify-center">
                  <VoucherGiftCard3D
                    asset={asset}
                    amount={split.perCard}
                    compact
                    showStack={false}
                  />
                </div>
              </>
            )}
          </div>
        )}

        <div>
          <label className="section-eyebrow">Message on card (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 280))}
            rows={3}
            placeholder="Happy day! Enjoy your onchain gift."
            className="w-full mt-1 input-ink rounded-xl px-3 py-3 text-sm outline-none resize-none"
          />
          <p className="text-[9px] text-[var(--ink-dim)] mt-1">{message.length}/280</p>
        </div>

        <p className="readable-body text-[10px]">
          Each wallet can redeem <span className="text-[var(--ink)] font-bold">one card per batch</span> — including the creator. Share unique Card ID + Secret per recipient.
        </p>

        {!pendingCards ? (
          <button
            type="button"
            onClick={prepareCreate}
            disabled={!contractReady || creating || !perCardWei}
            className="w-full py-3.5 rounded-xl font-black btn-primary disabled:opacity-40"
          >
            {creating ? "Preparing…" : "Create cards"}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-[var(--ink)]">
                    Batch #{pendingCards.batchId} · ready to fund
                  </p>
                  <p className="readable-body text-xs mt-1">
                    {formatVoucherAmount(pendingCards.asset, BigInt(pendingCards.totalAmount))} ·{" "}
                    {pendingCards.cardCount} card{pendingCards.cardCount === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cancelPendingCreate}
                  className="text-[10px] font-black text-[var(--ink-muted)] hover:text-red-400 uppercase shrink-0"
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3">
              <p className="text-sm font-black text-[var(--ink)]">Confirm in your wallet to create cards</p>
              <p className="readable-body text-xs mt-1">
                Card IDs and secret keys are generated now but{" "}
                <span className="text-[var(--ink)] font-bold">only shown after your deposit confirms</span>
                {pendingAsset === "USDC" && needsUsdcApproval
                  ? " — USDC requires approval first, then a separate deposit confirmation."
                  : "."}
              </p>
              <p className="readable-body text-xs text-[var(--ink-muted)] mt-2">
                Already deposited? Your cards will appear automatically once Base confirms the transaction.
              </p>
            </div>
            <VoucherSecurityNotice
              asset={pendingAsset}
              exactAmount={exactDepositLabel}
              needsApproval={pendingAsset === "USDC" && needsUsdcApproval}
            />
            {confirmingDeposit && (
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 animate-pulse">
                <p className="text-sm font-black text-amber-800">Confirming deposit on Base…</p>
                <p className="readable-body text-xs text-amber-700 mt-1">
                  Waiting for your deposit transaction to confirm. Keep this tab open — your Card
                  ID and Secret will appear automatically.
                </p>
              </div>
            )}
            {pendingAsset === "ETH" ? (
              <Transaction
                chainId={base.id}
                calls={prepareOnchainKitCalls(createEthCall)}
                capabilities={txCaps}
                onStatus={handleFundTx}
              >
                <TransactionButton
                  className="w-full py-3.5 rounded-xl font-black btn-primary"
                  text="Deposit"
                />
              </Transaction>
            ) : checkingAllowance ? (
              <button
                type="button"
                disabled
                className="w-full py-3.5 rounded-xl font-bold bg-[var(--surface-2)] text-[var(--ink-muted)]"
              >
                Checking USDC allowance…
              </button>
            ) : usdcAllowanceError ? (
              <button
                type="button"
                onClick={() => void refreshUsdcAllowance()}
                className="w-full py-3.5 rounded-xl font-black bg-amber-500/15 border border-amber-500/35 text-amber-800"
              >
                Could not read USDC allowance — tap to retry
              </button>
            ) : needsUsdcApproval ? (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest text-center">
                  Step 1 of 2 · Approve {exactDepositLabel}
                </p>
                <Transaction
                  key={`usdc-approve-${pendingCards.batchId}-${usdcTxKey}`}
                  chainId={base.id}
                  calls={prepareOnchainKitCalls(approveUsdcCall)}
                  capabilities={txCaps}
                  onStatus={handleApproveTx}
                >
                  <TransactionButton
                    className="w-full py-3.5 rounded-xl font-black btn-primary text-[var(--ink)]"
                    text={`Approve ${exactDepositLabel}`}
                  />
                </Transaction>
                <p className="readable-body text-[10px] text-center">
                  Approve exactly {exactDepositLabel}, then tap Deposit in step 2.
                </p>
              </div>
            ) : usdcReadyToFund ? (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest text-center">
                  Step 2 of 2 · Deposit {exactDepositLabel}
                </p>
                <Transaction
                  key={`usdc-fund-${pendingCards.batchId}-${usdcTxKey}`}
                  chainId={base.id}
                  calls={prepareOnchainKitCalls(createUsdcCall)}
                  capabilities={txCaps}
                  onStatus={handleFundTx}
                >
                  <TransactionButton
                    className="w-full py-3.5 rounded-xl font-black btn-primary text-[var(--ink)]"
                    text={`Deposit ${exactDepositLabel}`}
                  />
                </Transaction>
              </div>
            ) : (
              <button
                type="button"
                disabled
                className="w-full py-3.5 rounded-xl font-bold bg-[var(--surface-2)] text-[var(--ink-muted)]"
              >
                Preparing funding…
              </button>
            )}
          </div>
        )}

        {readyBatchOnCreate && (
          <div
            ref={createdSectionRef}
            className="border-2 border-emerald-400/40 bg-emerald-500/10 rounded-2xl p-4 sm:p-5 space-y-4 mt-4 scroll-mt-24"
          >
            {!readyBatchOnCreate.cards.some((c) => c.secret) && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                <p className="text-sm font-black text-amber-800">Card ID only — secret not stored</p>
                <p className="readable-body text-xs text-amber-700 mt-1">
                  Your deposit is on Base (Batch #{readyBatchOnCreate.batchId}). The app failed to
                  save the secret when your deposit confirmed — this is not from clearing history.
                  If you still have the secret from a screenshot or copy, you can redeem manually.
                </p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-emerald-700 font-black text-base sm:text-lg">
                  <CheckCircle size={20} /> Your cards are ready!
                </div>
                <p className="text-sm text-[var(--ink)] font-bold mt-1">Batch #{readyBatchOnCreate.batchId}</p>
                <p className="text-xs text-[var(--ink-muted)] font-bold mt-1">
                  {readyBatchOnCreate.cardCount} cards
                  {batchCardStatuses[readyBatchOnCreate.batchId]
                    ? ` · ${batchCardStatuses[readyBatchOnCreate.batchId].filter((c) => !c.redeemed).length} not redeemed yet`
                    : " · syncing redemption status…"}
                </p>
                <p className="text-xs text-amber-800 font-bold mt-2">
                  Save Card ID + Secret for each card — they cannot be recovered later.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => copyText(formatBatchShareText(readyBatchOnCreate), `batch-${readyBatchOnCreate.batchId}`)}
                  className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 rounded-xl btn-secondary"
                >
                  {copied === `batch-${readyBatchOnCreate.batchId}` ? <CheckCircle size={16} /> : <Copy size={16} />}
                  Copy all cards
                </button>
                <button
                  type="button"
                  onClick={() => shareText(formatBatchShareText(readyBatchOnCreate), `share-batch-${readyBatchOnCreate.batchId}`)}
                  className="flex items-center justify-center gap-2 text-sm font-black px-4 py-3 rounded-xl btn-primary"
                >
                  <Share2 size={16} /> Share all
                </button>
              </div>
            </div>

            {readyBatchOnCreate.message && (
              <p className="readable-body text-sm italic px-1">&quot;{readyBatchOnCreate.message}&quot;</p>
            )}

            <div className="space-y-4">
              {displayCardsForBatch(readyBatchOnCreate).map((c, i) => (
                <VoucherCredentialCard
                  key={c.cardId}
                  cardId={c.cardId}
                  secret={c.secret}
                  asset={readyBatchOnCreate.asset}
                  amountPerCard={BigInt(readyBatchOnCreate.amountPerCard)}
                  index={i}
                  total={readyBatchOnCreate.cardCount}
                  copied={copied}
                  onCopy={copyText}
                  onShare={shareText}
                  shareText={formatCardShareText(c, readyBatchOnCreate)}
                  redeemed={isCardRedeemed(c.cardId)}
                  statusLoading={
                    !isCardStatusKnown(c.cardId) &&
                    (mineStatusesLoading || loadingBatchDetail === readyBatchOnCreate.batchId)
                  }
                />
              ))}
            </div>

            <VoucherSharePanel batch={readyBatchOnCreate} />
          </div>
        )}
      </div>
    </SectionCard>
  );
}
