"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  CreditCard,
  Gift,
  RefreshCcw,
  CheckCircle2,
  Copy,
  QrCode,
  Download,
  ExternalLink,
  ChevronRight,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Key,
} from "lucide-react";
import type { useVoucherTab } from "@/hooks/useVoucherTab";
import type { StoredVoucherBatch, VoucherCard } from "@/lib/utils/voucher";
import {
  formatVoucherAmount,
  isStockAsset,
  isVaultShareAsset,
  getVaultShareBySymbol,
} from "@/lib/utils/voucher";
import { generateQrMatrix, generateQrSvgPath } from "@/lib/utils/qr-code";

type VoucherTab = ReturnType<typeof useVoucherTab>;

interface VoucherMyCardsProps {
  shared: VoucherTab["shared"];
  mine: VoucherTab["mine"];
  onCreateFirstGift?: () => void;
}

export default function VoucherMyCards({
  shared,
  mine,
  onCreateFirstGift,
}: VoucherMyCardsProps) {
  const { address } = shared;
  const {
    myBatches,
    chainStats,
    batchCardStatuses,
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
  } = mine;

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedBatchForDrawer, setSelectedBatchForDrawer] =
    useState<StoredVoucherBatch | null>(null);
  const [activeQrCard, setActiveQrCard] = useState<{
    cardId: string;
    link: string;
  } | null>(null);

  const origin = useMemo(() => {
    if (typeof window !== "undefined") return window.location.origin;
    return "https://base-analytics-app.vercel.app";
  }, []);

  const getClaimLink = useCallback(
    (card: VoucherCard) => {
      return `${origin}/?tab=basehub&view=redeem#id=${encodeURIComponent(
        card.cardId
      )}&secret=${encodeURIComponent(card.secret)}`;
    },
    [origin]
  );

  const copyText = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // CSV download for a batch
  const handleDownloadCsv = useCallback(
    (batch: StoredVoucherBatch) => {
      const displayCards = displayCardsForBatch(batch);
      const headers = "Card ID,Secret,Claim Link,Asset,Amount Per Card\n";
      const rows = displayCards
        .map((c) => {
          const link = c.secret ? getClaimLink(c) : "Secret not saved on device";
          const amount = formatVoucherAmount(
            batch.asset,
            BigInt(batch.amountPerCard)
          );
          return `"${c.cardId}","${c.secret}","${link}","${batch.asset}","${amount}"`;
        })
        .join("\n");

      const blob = new Blob([headers + rows], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `base-voucher-batch-${batch.batchId}-claim-links.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [displayCardsForBatch, getClaimLink]
  );

  // Open drawer
  const openBatchDrawer = (b: StoredVoucherBatch) => {
    setSelectedBatchForDrawer(b);
    setExpandedBatchId(b.batchId);
    void loadBatchDetail(b.batchId);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Sync */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-[var(--ink)]">
            My Gift Batches
          </h2>
          <p className="text-xs text-[var(--ink-muted)] mt-0.5">
            Manage your created gift batches, check claim progress, and export links.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshMyBatches}
          disabled={mineStatusesLoading}
          className="pop-pill flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink)] hover:bg-[var(--border-subtle)]/40 transition cursor-pointer"
        >
          <RefreshCcw
            size={13}
            className={mineStatusesLoading ? "animate-spin text-[var(--brand-text)]" : ""}
          />
          <span>{mineStatusesLoading ? "Syncing…" : "Refresh"}</span>
        </button>
      </div>

      {/* Empty State */}
      {myBatches.length === 0 ? (
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-8 sm:p-12 text-center space-y-5 shadow-sm">
          {/* Custom SVG Gift Illustration */}
          <div className="w-20 h-20 mx-auto rounded-3xl bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--border-subtle)] flex items-center justify-center shadow-inner">
            <Gift size={36} />
          </div>

          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-lg font-black text-[var(--ink)]">
              No gifts created yet
            </h3>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)] leading-relaxed">
              Create your first onchain gift card with tokenized stocks, yield-bearing vaults, USDC, or ETH.
            </p>
          </div>

          <button
            type="button"
            onClick={onCreateFirstGift}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-black text-sm bg-[#0052FF] text-white hover:bg-[#0047e0] active:scale-[0.98] transition shadow-md cursor-pointer"
          >
            <Sparkles size={16} />
            <span>Create Your First Gift</span>
          </button>

          {/* Recovery Accordion */}
          <div className="pt-6 border-t border-[var(--border-subtle)] max-w-md mx-auto text-left space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--ink-muted)] block">
              Deposited recently? Recover batch by transaction
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={recoverTxInput}
                onChange={(e) => setRecoverTxInput(e.target.value.trim())}
                placeholder="0x… Base transaction hash"
                className="flex-1 text-xs font-mono rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] px-3 py-2 text-[var(--ink)] outline-none focus:border-[var(--brand-text)]"
              />
              <button
                type="button"
                disabled={recoverLoading || !recoverTxInput}
                onClick={() => void recoverBatchByTx(recoverTxInput)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--surface-2)] border border-[var(--border-subtle)] hover:bg-[var(--border-subtle)]/40 transition disabled:opacity-40"
              >
                {recoverLoading ? "Recovering…" : "Recover"}
              </button>
            </div>
            {recoverError && (
              <p className="text-red-500 text-xs font-bold">{recoverError}</p>
            )}
          </div>
        </div>
      ) : (
        /* Batches List */
        <div className="grid gap-4">
          {myBatches.map((b) => {
            const redeemedCount = chainStats[b.batchId] ?? 0;
            const cardCount = b.cardCount;
            const pct = Math.round((redeemedCount / cardCount) * 100);
            const isFullyClaimed = redeemedCount >= cardCount;
            const isPartiallyClaimed = redeemedCount > 0 && !isFullyClaimed;
            const isActive = redeemedCount === 0;

            const displayCards = displayCardsForBatch(b);
            const hasLocalSecrets = displayCards.some(
              (c) => c.secret && c.secret.length > 0
            );

            return (
              <div
                key={b.batchId}
                className="pop-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 shadow-sm space-y-4 transition"
              >
                {/* Header Row: Batch #, Status Chip, Date */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-black text-[var(--ink)]">
                      Batch #{b.batchId}
                    </span>

                    {/* Status Chip */}
                    {isFullyClaimed ? (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                        Fully Claimed
                      </span>
                    ) : isPartiallyClaimed ? (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                        Partially Claimed
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                        Active
                      </span>
                    )}

                    {hasLocalSecrets && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--border-subtle)]">
                        Secrets saved
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-mono text-[var(--ink-muted)]">
                    {formatVoucherAmount(b.asset, BigInt(b.amountPerCard))} / card
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--ink-muted)] font-medium">
                      Claim progress
                    </span>
                    <span className="font-mono font-bold text-[var(--ink)] tabular-nums">
                      {redeemedCount} of {cardCount} claimed ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isFullyClaimed ? "bg-slate-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                </div>

                {/* Bottom Row: Message, Asset details & Open Drawer Button */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs">
                  <div className="flex items-center gap-2 truncate max-w-sm">
                    <span className="font-bold text-[var(--ink)]">{b.asset}</span>
                    {b.message && (
                      <span className="text-[var(--ink-muted)] italic truncate">
                        &quot;{b.message}&quot;
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => openBatchDrawer(b)}
                    className="pop-pill flex items-center gap-1 font-black text-xs text-[var(--brand-text)] hover:underline cursor-pointer shrink-0"
                  >
                    <span>View Cards &amp; Links</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Batch Detail Drawer / Modal */}
      {selectedBatchForDrawer && (
        <div
          className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-[var(--overlay)] backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedBatchForDrawer(null)}
        >
          <div
            className="w-full sm:max-w-xl max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-3)] shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-[var(--ink)]">
                    Batch #{selectedBatchForDrawer.batchId} Details
                  </span>
                  <span className="text-xs font-bold text-[var(--brand-text)] bg-[var(--brand-soft)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full">
                    {selectedBatchForDrawer.asset}
                  </span>
                </div>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                  {selectedBatchForDrawer.cardCount} cards ·{" "}
                  {formatVoucherAmount(
                    selectedBatchForDrawer.asset,
                    BigInt(selectedBatchForDrawer.amountPerCard)
                  )}{" "}
                  each
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBatchForDrawer(null)}
                className="p-2 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-2)] flex items-center justify-between shrink-0">
              <span className="text-xs text-[var(--ink-muted)]">
                {displayCardsForBatch(selectedBatchForDrawer).some(
                  (c) => c.secret
                )
                  ? "Secrets saved on this device"
                  : "Onchain batch record"}
              </span>

              {displayCardsForBatch(selectedBatchForDrawer).some(
                (c) => c.secret
              ) && (
                <button
                  type="button"
                  onClick={() => handleDownloadCsv(selectedBatchForDrawer)}
                  className="pop-pill flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--surface)] border border-[var(--border-subtle)] hover:bg-[var(--border-subtle)]/50 transition cursor-pointer"
                >
                  <Download size={13} />
                  <span>Re-download CSV</span>
                </button>
              )}
            </div>

            {/* Cards List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-0">
              {displayCardsForBatch(selectedBatchForDrawer).map((card, idx) => {
                const isClaimed =
                  batchCardStatuses[selectedBatchForDrawer.batchId]?.find(
                    (s) => s.cardId === card.cardId
                  )?.redeemed ?? false;
                const claimLink = card.secret ? getClaimLink(card) : "";
                const isCopied = copiedId === `drawer-${card.cardId}`;

                return (
                  <div
                    key={card.cardId}
                    className="pop-row rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)] font-black text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-mono text-xs font-bold text-[var(--ink)]">
                          {card.cardId}
                        </span>
                      </div>

                      {isClaimed ? (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-500">
                          Redeemed
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          Available
                        </span>
                      )}
                    </div>

                    {/* Secret Key Display */}
                    {card.secret ? (
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          <Key size={13} className="text-[var(--brand-text)] shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-wider text-[var(--ink-muted)] block">
                              Secret Key
                            </span>
                            <span className="font-mono text-xs font-bold text-[var(--ink)] select-all truncate block">
                              {card.secret}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(card.secret, `sec-${card.cardId}`)}
                          className="pop-pill flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--brand-soft)] text-[var(--brand-text)] hover:opacity-90 transition shrink-0 cursor-pointer"
                        >
                          {copiedId === `sec-${card.cardId}` ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <Copy size={13} />
                          )}
                          <span>{copiedId === `sec-${card.cardId}` ? "Copied" : "Copy Key"}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
                        Secret key was not preserved on this device.
                      </div>
                    )}

                    {/* Claim Link */}
                    {card.secret && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={claimLink}
                          className="flex-1 text-xs font-mono bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-xl px-2.5 py-1.5 text-[var(--ink-muted)] truncate outline-none select-all"
                        />
                        <button
                          type="button"
                          onClick={() => copyText(claimLink, `drawer-${card.cardId}`)}
                          className="pop-pill flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink)] hover:bg-[var(--border-subtle)]/50 transition shrink-0 cursor-pointer"
                        >
                          {isCopied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                          <span>{isCopied ? "Copied Link" : "Copy Link"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveQrCard({
                              cardId: card.cardId,
                              link: claimLink,
                            })
                          }
                          className="p-1.5 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] border border-[var(--border-subtle)] transition shrink-0 cursor-pointer"
                          title="Show QR Code"
                        >
                          <QrCode size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal for Drawer */}
      {activeQrCard && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-[var(--overlay)] p-4"
          onClick={() => setActiveQrCard(null)}
        >
          <div
            className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-3)] p-6 max-w-sm w-full space-y-4 text-center animate-in zoom-in-95 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[var(--ink)]">
                QR Code · Card {activeQrCard.cardId}
              </span>
              <button
                type="button"
                onClick={() => setActiveQrCard(null)}
                className="p-1 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl flex justify-center shadow-inner">
              {(() => {
                const matrix = generateQrMatrix(activeQrCard.link);
                const path = generateQrSvgPath(matrix);
                const size = matrix.length;
                return (
                  <svg
                    viewBox={`0 0 ${size} ${size}`}
                    className="w-48 h-48"
                    shapeRendering="crispEdges"
                  >
                    <path d={path} fill="#000000" />
                  </svg>
                );
              })()}
            </div>

            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              Scan with mobile camera to claim instantly.
            </p>

            <button
              type="button"
              onClick={() => copyText(activeQrCard.link, `qr-copied-drawer`)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#0052FF] text-white hover:bg-[#0047e0] transition"
            >
              {copiedId === "qr-copied-drawer" ? "Copied Link!" : "Copy Claim Link"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
