"use client";

import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  RefreshCcw,
  Share2,
} from "lucide-react";
import {
  formatVoucherAmount,
  formatCardShareText,
  formatBatchShareText,
} from "@/lib/utils/voucher";
import { buildPayLinkUrl } from "@/lib/utils/voucher-share";
import SectionCard from "@/components/ui/SectionCard";
import VoucherCredentialCard from "@/components/wallet/VoucherCredentialCard";
import type { useVoucherTab } from "@/hooks/useVoucherTab";

type VoucherTab = ReturnType<typeof useVoucherTab>;

export default function VoucherMinePanel({
  shared,
  mine,
}: {
  shared: VoucherTab["shared"];
  mine: VoucherTab["mine"];
}) {
  const { address, connType, copied, copyText, shareText } = shared;
  const {
    myBatches,
    chainStats,
    batchCardStatuses,
    creatorSummary,
    expandedBatchId,
    setExpandedBatchId,
    loadingBatchDetail,
    mineStatusesLoading,
    recoverTxInput,
    setRecoverTxInput,
    recoverLoading,
    recoverError,
    recoverBatchByTx,
    refreshMyBatches,
    loadBatchDetail,
    displayCardsForBatch,
    isCardRedeemed,
    isCardStatusKnown,
  } = mine;

  return (
    <div className="space-y-3">
      <div className="page-hero">
        <p className="section-eyebrow">My vouchers</p>
        <p className="readable-body text-sm mt-1">
          Track batches you created, share pay links, and recover cards from onchain deposits.
        </p>
      </div>

      {address && (
        <SectionCard bar={false} className="border border-[var(--border-subtle)]">
          <p className="section-eyebrow">Your pay link</p>
          <p className="readable-body text-xs mt-1">
            Share this link so anyone can send you vouchers or explore x402 on Base.
          </p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <code className="flex-1 text-[11px] font-mono text-[var(--ink)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 truncate">
              {buildPayLinkUrl(address)}
            </code>
            <button
              type="button"
              onClick={() => copyText(buildPayLinkUrl(address), "pay-link")}
              className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl btn-secondary shrink-0"
            >
              {copied === "pay-link" ? <CheckCircle size={14} /> : <Copy size={14} />}
              Copy link
            </button>
          </div>
        </SectionCard>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="section-eyebrow">Your voucher batches</p>
          <p className="readable-body text-[10px] mt-0.5">Tap a batch to view its cards</p>
        </div>
        <div className="flex items-center gap-2">
          {mineStatusesLoading && (
            <span className="text-[10px] text-[var(--ink-muted)] flex items-center gap-1">
              <RefreshCcw size={12} className="animate-spin" /> Syncing…
            </span>
          )}
          <button onClick={refreshMyBatches} className="text-[var(--ink-dim)] hover:text-[var(--ink)] p-1">
            <RefreshCcw size={14} />
          </button>
        </div>
      </div>

      {(connType === "coinbase" || connType === "baseAccount" || connType === "farcaster") && (
        <SectionCard bar={false} className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <p className="section-eyebrow">Base App deposit</p>
          <p className="readable-body text-xs mt-2">
            Deposits through Base App use a smart wallet bundle. If your batch
            doesn&apos;t appear right away, paste your deposit transaction hash
            below — we link it to your wallet automatically.
          </p>
          <div className="mt-3 space-y-2">
            <input
              value={recoverTxInput}
              onChange={(e) => setRecoverTxInput(e.target.value.trim())}
              placeholder="0x… deposit tx hash"
              className="w-full input-ink rounded-xl px-3 py-2.5 text-[var(--ink)] font-mono text-xs outline-none"
            />
            {recoverError && (
              <p className="text-red-400 text-xs font-bold">{recoverError}</p>
            )}
            <button
              type="button"
              disabled={recoverLoading || !recoverTxInput}
              onClick={() => void recoverBatchByTx(recoverTxInput)}
              className="w-full py-2.5 rounded-xl text-xs font-black bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--ink)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
            >
              {recoverLoading ? "Linking batch…" : "Link deposit to My Cards"}
            </button>
          </div>
        </SectionCard>
      )}

      {creatorSummary && creatorSummary.batchCount > 0 && (
        <SectionCard bar={false} className="border border-amber-500/25 bg-amber-500/5">
          <p className="section-eyebrow text-amber-300/80">Creator analytics</p>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div>
              <p className="text-lg font-black text-[var(--ink)]">{creatorSummary.batchCount}</p>
              <p className="text-[9px] uppercase text-[var(--ink-muted)] font-bold">Batches</p>
            </div>
            <div>
              <p className="text-lg font-black text-emerald-300">
                {creatorSummary.totalCards - creatorSummary.totalUnredeemed}
              </p>
              <p className="text-[9px] uppercase text-[var(--ink-muted)] font-bold">Redeemed</p>
            </div>
            <div>
              <p className="text-lg font-black text-amber-300">{creatorSummary.totalUnredeemed}</p>
              <p className="text-[9px] uppercase text-[var(--ink-muted)] font-bold">Unredeemed</p>
            </div>
          </div>
          <p className="readable-body text-xs mt-2">
            {creatorSummary.totalCards} total cards across your batches
          </p>
        </SectionCard>
      )}

      {myBatches.length === 0 ? (
        <SectionCard>
          <div className="py-6 text-center space-y-4">
            <CreditCard size={28} className="text-[var(--ink-dim)] mx-auto" />
            <p className="text-[var(--ink-muted)] text-sm font-bold">
              No vouchers yet — or your deposit needs to be linked.
            </p>
            <div className="text-left max-w-md mx-auto space-y-2 pt-2">
              <label className="section-eyebrow">
                Recover by deposit transaction hash
              </label>
              <input
                value={recoverTxInput}
                onChange={(e) => setRecoverTxInput(e.target.value.trim())}
                placeholder="0x…"
                className="w-full input-ink rounded-xl px-3 py-3 text-[var(--ink)] font-mono text-xs outline-none"
              />
              {recoverError && (
                <p className="text-red-400 text-xs font-bold">{recoverError}</p>
              )}
              <button
                type="button"
                disabled={recoverLoading || !recoverTxInput}
                onClick={() => void recoverBatchByTx(recoverTxInput)}
                className="w-full py-3 rounded-xl font-black btn-primary disabled:opacity-40"
              >
                {recoverLoading ? "Recovering…" : "Recover my batch"}
              </button>
              <p className="readable-body text-[10px]">
                Paste the Base transaction hash from your wallet after depositing. Card
                secrets only appear if this browser still has them saved.
              </p>
            </div>
          </div>
        </SectionCard>
      ) : (
        myBatches.map((b) => {
          const redeemed = chainStats[b.batchId] ?? 0;
          const unredeemed = Math.max(0, b.cardCount - redeemed);
          const pct = Math.round((redeemed / b.cardCount) * 100);
          const cardStatuses = batchCardStatuses[b.batchId];
          const displayCards = displayCardsForBatch(b);
          const hasLocalSecrets = displayCards.some((c) => c.secret.length > 0);
          const isExpanded = expandedBatchId === b.batchId;

          const toggleBatch = () => {
            if (isExpanded) {
              setExpandedBatchId(null);
              return;
            }
            setExpandedBatchId(b.batchId);
            void loadBatchDetail(b.batchId);
          };

          return (
            <SectionCard key={b.batchId} bar={false} className="border border-[var(--border-subtle)] overflow-hidden">
              <button
                type="button"
                className="w-full text-left"
                onClick={toggleBatch}
                aria-expanded={isExpanded}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-[var(--ink)]">Batch #{b.batchId}</p>
                      {hasLocalSecrets && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 border border-emerald-500/25 uppercase">
                          Secrets saved
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                      {formatVoucherAmount(b.asset, BigInt(b.totalAmount))} · {b.cardCount} card
                      {b.cardCount === 1 ? "" : "s"}
                    </p>
                    {b.message && !isExpanded && (
                      <p className="readable-body text-xs italic mt-1 truncate">
                        &quot;{b.message}&quot;
                      </p>
                    )}
                  </div>
                  <div className="flex items-start gap-2 shrink-0">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-[var(--bg-elevated)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
                        {redeemed}/{b.cardCount} redeemed
                      </span>
                      {unredeemed > 0 && (
                        <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {unredeemed} available
                        </span>
                      )}
                    </div>
                    <span className="text-[var(--ink-muted)] mt-1">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </div>
                </div>
                {!isExpanded && (
                  <div className="w-full bg-[var(--surface-2)] rounded-full h-1 overflow-hidden mt-3">
                    <div
                      className="h-full bg-[var(--accent)] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </button>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-4">
                  {b.message && (
                    <p className="readable-body text-xs italic">&quot;{b.message}&quot;</p>
                  )}

                  <div className="w-full bg-[var(--surface-2)] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {hasLocalSecrets && (
                      <>
                        <button
                          type="button"
                          onClick={() => copyText(formatBatchShareText(b), `batch-${b.batchId}`)}
                          className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl btn-secondary"
                        >
                          {copied === `batch-${b.batchId}` ? (
                            <CheckCircle size={14} />
                          ) : (
                            <Copy size={14} />
                          )}
                          Copy all cards
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            shareText(formatBatchShareText(b), `share-batch-${b.batchId}`)
                          }
                          className="flex items-center gap-2 text-sm font-black px-4 py-2.5 rounded-xl btn-primary"
                        >
                          <Share2 size={14} /> Share batch
                        </button>
                      </>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="section-eyebrow">
                      {displayCards.length} card{displayCards.length === 1 ? "" : "s"} in this batch
                    </p>
                    {displayCards.map((c, i) => (
                      <VoucherCredentialCard
                        key={c.cardId}
                        cardId={c.cardId}
                        secret={c.secret}
                        asset={b.asset}
                        amountPerCard={BigInt(b.amountPerCard)}
                        index={i}
                        total={b.cardCount}
                        copied={copied}
                        onCopy={copyText}
                        onShare={shareText}
                        shareText={formatCardShareText(c, b)}
                        redeemed={isCardRedeemed(c.cardId)}
                        statusLoading={
                          !isCardStatusKnown(c.cardId) &&
                          (mineStatusesLoading || loadingBatchDetail === b.batchId)
                        }
                      />
                    ))}
                  </div>

                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 space-y-2">
                    <p className="section-eyebrow">Redemption status</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(cardStatuses?.length
                        ? cardStatuses
                        : displayCards.map((c) => ({
                            cardId: c.cardId,
                            redeemed: isCardRedeemed(c.cardId),
                          }))
                      ).map((c) => (
                        <div
                          key={c.cardId}
                          className={`rounded-lg px-3 py-2.5 text-xs font-bold border ${
                            c.redeemed
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-800"
                          }`}
                        >
                          <span className="font-mono text-sm">{c.cardId}</span>
                          <p className="mt-0.5 text-[10px] uppercase tracking-wide opacity-80">
                            {c.redeemed ? "Redeemed" : "Available to redeem"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>
          );
        })
      )}
    </div>
  );
}
