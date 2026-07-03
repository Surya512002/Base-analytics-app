"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, Copy, Gift, ShieldCheck } from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";
import VoucherCredentialCard from "@/components/wallet/VoucherCredentialCard";
import {
  formatBatchShareText,
  formatCardShareText,
  formatVoucherAmount,
  type StoredVoucherBatch,
} from "@/lib/utils/voucher";

interface VoucherCardsReadyGateProps {
  batch: StoredVoucherBatch | null;
  onDismiss: () => void;
}

export default function VoucherCardsReadyGate({ batch, onDismiss }: VoucherCardsReadyGateProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyAllDone, setCopyAllDone] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!batch) return;
    setCopyAllDone(false);
    setAcknowledged(false);
    setCopied(null);
  }, [batch?.batchId]);

  useEffect(() => {
    if (!batch) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [batch]);

  const copyText = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 2000);
  }, []);

  const shareText = useCallback(async (text: string, id: string) => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Base Voucher Gift Card", text });
        setCopyAllDone(true);
        return;
      } catch {
        /* fall through to copy */
      }
    }
    copyText(text, id);
    setCopyAllDone(true);
  }, [copyText]);

  const handleCopyAll = useCallback(() => {
    if (!batch) return;
    const text = formatBatchShareText(batch);
    copyText(text, `gate-batch-${batch.batchId}`);
    setCopyAllDone(true);
  }, [batch, copyText]);

  if (!mounted || !batch) return null;

  const hasSecrets = batch.cards.some((c) => c.secret.trim().length > 0);
  const canContinue = hasSecrets ? copyAllDone && acknowledged : acknowledged;

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voucher-cards-ready-title"
    >
      <div className="w-full sm:max-w-lg max-h-[96dvh] sm:max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-emerald-500/30 bg-[#0a0f18] shadow-2xl shadow-emerald-500/10 overflow-hidden">
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-white/10 bg-linear-to-b from-emerald-500/12 to-transparent">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Gift size={22} className="text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                Deposit confirmed
              </p>
              <h2 id="voucher-cards-ready-title" className="text-lg font-black text-white truncate">
                Your cards are ready
              </h2>
            </div>
            <AppLogo className="w-8 h-8 opacity-60 shrink-0" />
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Batch <span className="text-white font-bold">#{batch.batchId}</span>
            {" · "}
            {batch.cardCount} card{batch.cardCount === 1 ? "" : "s"}
            {" · "}
            {formatVoucherAmount(batch.asset, BigInt(batch.totalAmount))}
          </p>
          {hasSecrets ? (
            <p className="text-xs text-amber-200 font-bold mt-2 leading-relaxed">
              Copy every Card ID + Secret now. They are saved to your wallet on our server, but you
              need them to share with recipients.
            </p>
          ) : (
            <p className="text-xs text-amber-300 font-bold mt-2 leading-relaxed">
              Card IDs are shown below. Secrets were not found — check My Cards after refreshing, or
              contact support with your deposit tx hash.
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {batch.message && (
            <p className="text-sm text-slate-400 italic text-center">&quot;{batch.message}&quot;</p>
          )}

          {hasSecrets && (
            <button
              type="button"
              onClick={handleCopyAll}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm bg-cyan-500 hover:bg-cyan-400 text-white active:scale-[0.98] transition"
            >
              {copied === `gate-batch-${batch.batchId}` ? (
                <CheckCircle size={18} />
              ) : (
                <Copy size={18} />
              )}
              {copied === `gate-batch-${batch.batchId}` ? "Copied all cards!" : "Copy all Card IDs + Secrets"}
            </button>
          )}

          <div className="space-y-3">
            {batch.cards.map((c, i) => (
              <VoucherCredentialCard
                key={c.cardId}
                cardId={c.cardId}
                secret={c.secret}
                asset={batch.asset}
                amountPerCard={BigInt(batch.amountPerCard)}
                index={i}
                total={batch.cardCount}
                copied={copied}
                onCopy={(text, id) => {
                  copyText(text, id);
                  if (id.startsWith("both-") || id.startsWith("sec-")) {
                    setCopyAllDone(true);
                  }
                }}
                onShare={(text, id) => {
                  void shareText(text, id);
                }}
                shareText={formatCardShareText(c, batch)}
                showAmount={batch.cardCount > 1}
              />
            ))}
          </div>
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-white/10 bg-black/40 space-y-3">
          {hasSecrets && (
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-cyan-500/50 accent-cyan-500"
              />
              <span className="text-xs text-slate-300 leading-relaxed group-hover:text-white transition">
                I copied or saved every Card ID and Secret. I understand recipients need both to
                redeem.
              </span>
            </label>
          )}

          {!hasSecrets && (
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-amber-500/50 accent-amber-500"
              />
              <span className="text-xs text-slate-300 leading-relaxed">
                I understand secrets are missing for this batch and may appear in My Cards after
                refresh.
              </span>
            </label>
          )}

          <button
            type="button"
            disabled={!canContinue}
            onClick={onDismiss}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm btn-primary disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition"
          >
            <ShieldCheck size={18} />
            {hasSecrets ? "I've saved my secrets — continue" : "Continue to My Cards"}
          </button>

          {hasSecrets && !copyAllDone && (
            <p className="text-[10px] text-center text-slate-500 font-bold">
              Tap &quot;Copy all Card IDs + Secrets&quot; first, then check the box above.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
