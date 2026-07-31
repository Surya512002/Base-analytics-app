"use client";

import { AlertCircle } from "lucide-react";
import type { VoucherAsset } from "@/lib/utils/voucher";
import VoucherGiftCard3D from "@/components/wallet/VoucherGiftCard3D";

export default function VoucherCardPreview({
  cardId,
  secret,
  asset,
  amount,
  message,
  redeemed,
  showSecret = true,
  showRedeemedNotice = true,
}: {
  cardId: string;
  secret?: string;
  asset: VoucherAsset;
  amount: bigint;
  message?: string;
  redeemed?: boolean;
  showSecret?: boolean;
  showRedeemedNotice?: boolean;
}) {
  return (
    <div className="space-y-3">
      {showRedeemedNotice && redeemed && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
          <AlertCircle size={16} className="text-amber-300 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-amber-800">This card has already been redeemed</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Card <span className="font-mono font-bold">{cardId}</span> was used onchain.
            </p>
          </div>
        </div>
      )}
      <VoucherGiftCard3D
        asset={asset}
        amount={amount}
        message={message}
        status={redeemed ? "redeemed" : "active"}
        compact
        flat
        showStack={false}
      />
      <div className="glass-panel-accent rounded-xl px-3 py-2.5 space-y-1">
        <p className="text-[9px] font-black text-[var(--ink-muted)] uppercase tracking-widest">
          Card ID · {cardId}
        </p>
        {showSecret && secret ? (
          <p className="font-mono text-xs text-[var(--ink-soft)] tracking-wider break-all">{secret}</p>
        ) : (
          <p className="font-mono text-xs text-[var(--ink-muted)] tracking-wider">•••••-•••••-•••••-•••••</p>
        )}
      </div>
      {message && (
        <p className="text-sm text-[var(--ink-soft)] italic px-1 leading-relaxed">&quot;{message}&quot;</p>
      )}
    </div>
  );
}
