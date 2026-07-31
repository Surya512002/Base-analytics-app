"use client";

import { CheckCircle, Copy, Share2 } from "lucide-react";
import { formatVoucherAmount, type VoucherAsset } from "@/lib/utils/voucher";

interface VoucherCredentialCardProps {
  cardId: string;
  secret: string;
  asset: VoucherAsset;
  amountPerCard: bigint;
  index: number;
  total: number;
  copied: string | null;
  onCopy: (text: string, id: string) => void;
  onShare: (text: string, id: string) => void;
  shareText: string;
  showAmount?: boolean;
  redeemed?: boolean;
  statusLoading?: boolean;
}

function CopyField({
  label,
  value,
  copyId,
  copied,
  onCopy,
  mono = true,
}: {
  label: string;
  value: string;
  copyId: string;
  copied: string | null;
  onCopy: (text: string, id: string) => void;
  mono?: boolean;
}) {
  const done = copied === copyId;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-black text-[var(--ink-muted)] uppercase tracking-widest">{label}</p>
        <button
          type="button"
          onClick={() => onCopy(value, copyId)}
          className="flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--ink)] hover:bg-[var(--bg-hover)] active:scale-95 transition"
        >
          {done ? <CheckCircle size={14} /> : <Copy size={14} />}
          {done ? "Copied!" : "Copy"}
        </button>
      </div>
      <div
        className={`w-full rounded-xl px-4 py-3.5 bg-[var(--surface-2)] border-2 border-[var(--border-subtle)] text-[var(--ink)] font-black select-all ${
          mono ? "font-mono text-base sm:text-lg tracking-wider break-all" : "text-base"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export default function VoucherCredentialCard({
  cardId,
  secret,
  asset,
  amountPerCard,
  index,
  total,
  copied,
  onCopy,
  onShare,
  shareText,
  showAmount = true,
  redeemed = false,
  statusLoading = false,
}: VoucherCredentialCardProps) {
  const bothId = `both-${cardId}`;
  const shareId = `share-${cardId}`;
  const hasSecret = secret.trim().length > 0;

  return (
    <div
      className={`rounded-2xl border-2 p-4 sm:p-5 space-y-4 ${
        redeemed
          ? "border-slate-500/35 bg-slate-500/8 opacity-75"
          : "border-emerald-500/35 bg-emerald-500/6"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-black text-[var(--ink)]">
          Card <span className="text-[var(--ink)]">{index + 1}</span>
          <span className="text-[var(--ink-muted)] font-bold"> / {total}</span>
        </p>
        <div className="flex items-center gap-2">
          {statusLoading ? (
            <span className="text-[10px] font-black text-[var(--ink-muted)] uppercase tracking-wide">
              Checking…
            </span>
          ) : redeemed ? (
            <span className="text-xs font-black text-[var(--ink-muted)] bg-slate-500/20 border border-slate-500/30 px-3 py-1 rounded-full">
              Redeemed
            </span>
          ) : (
            <>
              {showAmount && (
                <span className="text-xs font-black text-emerald-700 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full">
                  {formatVoucherAmount(asset, amountPerCard)}
                </span>
              )}
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wide">
                Available
              </span>
            </>
          )}
        </div>
      </div>

      {redeemed && (
        <p className="text-xs text-[var(--ink-muted)] font-bold -mt-1">
          This card was already redeemed onchain and can no longer be used.
        </p>
      )}

      <CopyField
        label="Card ID"
        value={cardId || "—"}
        copyId={`id-${cardId}`}
        copied={copied}
        onCopy={onCopy}
      />

      {hasSecret ? (
        <CopyField
          label="Secret Key"
          value={secret}
          copyId={`sec-${cardId}`}
          copied={copied}
          onCopy={onCopy}
        />
      ) : (
        <div>
          <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1.5">
            Secret Key
          </p>
          <div className="rounded-xl px-4 py-3.5 bg-amber-500/10 border-2 border-amber-500/30">
            <p className="text-sm font-bold text-amber-800">Secret not saved on this device</p>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              Secrets are stored by your wallet address on our server after you create cards.
              This batch was created before that fix, or the save failed — the secret cannot be
              read from the blockchain.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        {hasSecret && (
          <button
            type="button"
            onClick={() => onCopy(`${cardId}\n${secret}`, bothId)}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink)] hover:bg-[var(--bg-hover)] active:scale-[0.98] transition"
          >
            {copied === bothId ? <CheckCircle size={16} /> : <Copy size={16} />}
            {copied === bothId ? "Copied ID + Secret!" : "Copy ID + Secret"}
          </button>
        )}
        {hasSecret && (
          <button
            type="button"
            onClick={() => onCopy(shareText, cardId)}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink-soft)] hover:bg-[var(--bg-hover)] active:scale-[0.98] transition"
          >
            {copied === cardId ? <CheckCircle size={16} /> : <Copy size={16} />}
            Copy full card
          </button>
        )}
        <button
          type="button"
          onClick={() => onCopy(cardId, `id-only-${cardId}`)}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--ink)] hover:bg-[var(--bg-hover)] active:scale-[0.98] transition"
        >
          {copied === `id-only-${cardId}` ? <CheckCircle size={16} /> : <Copy size={16} />}
          Copy Card ID
        </button>
        {hasSecret && (
          <button
            type="button"
            onClick={() => onShare(shareText, shareId)}
            disabled={redeemed}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm btn-primary active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Share2 size={16} /> Share
          </button>
        )}
      </div>
    </div>
  );
}
