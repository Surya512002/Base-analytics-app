"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Copy,
  Download,
  QrCode,
  Share2,
  ShieldAlert,
  ShieldCheck,
  X,
  ExternalLink,
  Gift,
  Mail,
  MessageCircle,
} from "lucide-react";
import type { StoredVoucherBatch, VoucherCard } from "@/lib/utils/voucher";
import { formatVoucherAmount } from "@/lib/utils/voucher";
import { generateQrMatrix, generateQrSvgPath } from "@/lib/utils/qr-code";

interface VoucherShareSuccessModalProps {
  batch: StoredVoucherBatch | null;
  onClose: () => void;
}

export default function VoucherShareSuccessModal({
  batch,
  onClose,
}: VoucherShareSuccessModalProps) {
  const [mounted, setMounted] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [activeQrCard, setActiveQrCard] = useState<{
    cardId: string;
    link: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (batch) {
      setConfirmedSaved(false);
      setCopiedId(null);
      setActiveQrCard(null);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [batch]);

  // Origin for links
  const origin = useMemo(() => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "https://base-analytics-app.vercel.app";
  }, []);

  // Generate safe claim link with secret in fragment (#)
  const getClaimLink = useCallback(
    (card: VoucherCard) => {
      return `${origin}/?tab=basehub&view=redeem#id=${encodeURIComponent(
        card.cardId
      )}&secret=${encodeURIComponent(card.secret)}`;
    },
    [origin]
  );

  // Copy helper
  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Copy all links formatted
  const handleCopyAll = useCallback(() => {
    if (!batch) return;
    const lines = [
      `🎁 Base Voucher Batch #${batch.batchId} (${batch.cardCount} cards of ${batch.asset})`,
      batch.message ? `Message: "${batch.message}"` : "",
      "",
      ...batch.cards.map((c, i) => {
        const link = getClaimLink(c);
        return `Card #${i + 1} (${c.cardId})\nClaim Link: ${link}\nSecret: ${c.secret}\n`;
      }),
    ].filter(Boolean);

    handleCopy(lines.join("\n"), "all-links");
  }, [batch, getClaimLink, handleCopy]);

  // Download CSV
  const handleDownloadCsv = useCallback(() => {
    if (!batch) return;
    const headers = "Card ID,Secret,Claim Link,Asset,Amount Per Card\n";
    const rows = batch.cards
      .map((c) => {
        const link = getClaimLink(c);
        const amount = formatVoucherAmount(batch.asset, BigInt(batch.amountPerCard));
        return `"${c.cardId}","${c.secret}","${link}","${batch.asset}","${amount}"`;
      })
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `base-voucher-batch-${batch.batchId}-claim-links.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [batch, getClaimLink]);

  // Social sharing helpers
  const handleShareX = useCallback(
    (card?: VoucherCard) => {
      const text = card
        ? `I just gifted you an onchain voucher on Base! Claim it here:`
        : `I just created ${batch?.cardCount} onchain gift cards on @base!`;
      const url = card ? getClaimLink(card) : origin;
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        "_blank"
      );
    },
    [batch, getClaimLink, origin]
  );

  const handleShareWhatsApp = useCallback(
    (card: VoucherCard) => {
      const link = getClaimLink(card);
      const text = `🎁 Here is your onchain gift card on Base!\n\nClaim link: ${link}\n(Secret is auto-filled)`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    },
    [getClaimLink]
  );

  const handleShareEmail = useCallback(
    (card: VoucherCard) => {
      const link = getClaimLink(card);
      const subject = `Your Base Onchain Gift Card`;
      const body = `Hi!\n\nHere is your onchain gift card on Base for ${formatVoucherAmount(
        batch!.asset,
        BigInt(batch!.amountPerCard)
      )}.\n\nClick this secure link to claim it directly to your wallet:\n${link}\n\nEnjoy!`;
      window.open(
        `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      );
    },
    [batch, getClaimLink]
  );

  const handleNativeShare = useCallback(
    async (card: VoucherCard) => {
      const link = getClaimLink(card);
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: "Your Base Gift Card",
            text: `Claim your ${batch?.asset} gift card on Base:`,
            url: link,
          });
          return;
        } catch {
          /* Fall back to copy */
        }
      }
      handleCopy(link, `link-${card.cardId}`);
    },
    [batch, getClaimLink, handleCopy]
  );

  if (!mounted || !batch) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--overlay)] backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-share-title"
    >
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-3)] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[var(--border-subtle)] bg-emerald-500/10 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Gift size={24} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  Deposit Confirmed on Base
                </span>
                <h2 id="success-share-title" className="text-xl font-black text-[var(--ink)]">
                  Your Gift Cards Are Ready!
                </h2>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-black text-[var(--ink)]">
                Batch #{batch.batchId}
              </p>
              <p className="text-xs text-[var(--ink-muted)]">
                {batch.cardCount} {batch.cardCount === 1 ? "card" : "cards"} ·{" "}
                {formatVoucherAmount(batch.asset, BigInt(batch.totalAmount))}
              </p>
            </div>
          </div>

          {/* Security alert: Secrets cannot be recovered */}
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/15 p-3 flex items-start gap-2.5">
            <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <span className="font-black">Secrets cannot be recovered later.</span> Each card has a unique secret built into the claim link fragment (<code className="font-mono bg-black/20 px-1 rounded">#secret=...</code>). Download the CSV or copy the links now before closing.
            </div>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-2)] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAll}
              className="pop-pill flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0052FF] text-white hover:bg-[#0047e0] transition cursor-pointer"
            >
              {copiedId === "all-links" ? (
                <CheckCircle2 size={14} />
              ) : (
                <Copy size={14} />
              )}
              <span>{copiedId === "all-links" ? "Copied All!" : "Copy All Links"}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="pop-pill flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--ink)] hover:bg-[var(--border-subtle)]/40 transition cursor-pointer"
            >
              <Download size={14} />
              <span>Download CSV</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleShareX()}
            className="pop-pill flex items-center gap-1 text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--brand-text)] px-2 py-1.5 transition cursor-pointer"
          >
            <span>Announce on X</span>
            <ExternalLink size={12} />
          </button>
        </div>

        {/* Per-Card Share List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-0">
          {batch.cards.map((card, idx) => {
            const claimLink = getClaimLink(card);
            const isCopied = copiedId === `link-${card.cardId}`;

            return (
              <div
                key={card.cardId}
                className="pop-row rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 space-y-3 hover:border-[var(--brand)]/30 transition"
              >
                {/* Top Row: Card Title & Amount */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)] font-black text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-mono text-xs font-bold text-[var(--ink)]">
                      Card ID: {card.cardId}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                    {formatVoucherAmount(batch.asset, BigInt(batch.amountPerCard))}
                  </span>
                </div>

                {/* Claim Link Fragment Bar */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={claimLink}
                    className="flex-1 text-xs font-mono bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-[var(--ink-muted)] truncate outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(claimLink, `link-${card.cardId}`)}
                    className="pop-pill flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--brand)]/20 hover:bg-[var(--brand-soft)] transition shrink-0 cursor-pointer"
                  >
                    {isCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    <span>{isCopied ? "Copied" : "Copy Link"}</span>
                  </button>
                </div>

                {/* Per-Card Action Buttons: QR, WhatsApp, Email, Native Share */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="font-mono text-[10px] text-[var(--ink-dim)]">
                    Secret: {card.secret}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveQrCard({ cardId: card.cardId, link: claimLink })
                      }
                      title="Show QR Code"
                      className="p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition"
                    >
                      <QrCode size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(card)}
                      title="Share via WhatsApp"
                      className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition"
                    >
                      <MessageCircle size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShareEmail(card)}
                      title="Share via Email"
                      className="p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition"
                    >
                      <Mail size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleNativeShare(card)}
                      title="Share link"
                      className="p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--surface-2)] transition"
                    >
                      <Share2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: Confirmation Guard & Continue */}
        <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--surface-2)] space-y-3 shrink-0">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmedSaved}
              onChange={(e) => setConfirmedSaved(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-[var(--border-subtle)] accent-[var(--brand)]"
            />
            <span className="text-xs text-[var(--ink)] leading-relaxed">
              <strong>I have copied, saved, or downloaded these claim links.</strong> I understand recipients need the link to redeem their funds.
            </span>
          </label>

          <button
            type="button"
            disabled={!confirmedSaved}
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm bg-[#0052FF] text-white hover:bg-[#0047e0] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition cursor-pointer shadow-md"
          >
            <ShieldCheck size={18} />
            <span>I&apos;ve saved these — Continue to My Cards</span>
          </button>
        </div>
      </div>

      {/* QR Code Modal Overlay */}
      {activeQrCard && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-[var(--overlay)] p-4"
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

            {/* QR SVG */}
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
              Recipient can scan this QR code with any mobile camera to open and redeem the voucher instantly.
            </p>

            <button
              type="button"
              onClick={() => handleCopy(activeQrCard.link, `qr-copied`)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#0052FF] text-white hover:bg-[#0047e0] transition"
            >
              {copiedId === "qr-copied" ? "Copied Link!" : "Copy Claim Link"}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
