"use client";

import { AlertCircle } from "lucide-react";

export default function VoucherRedeemStatusBanner({
  cardId,
  redeemed,
  loading,
}: {
  cardId?: string;
  redeemed?: boolean;
  loading?: boolean;
}) {
  if (loading || !redeemed || !cardId) return null;

  return (
    <div
      role="alert"
      className="rounded-2xl border-2 border-red-400/55 bg-red-500/15 px-4 py-4 flex items-start gap-3"
    >
      <AlertCircle size={22} className="text-red-300 shrink-0 mt-0.5" />
      <div>
        <p className="text-base sm:text-lg font-black text-red-100">This card is already redeemed</p>
        <p className="text-sm text-red-200/85 mt-1 leading-relaxed">
          Card <span className="font-mono font-bold text-[var(--ink)]">{cardId}</span> was already claimed on
          Base. You cannot redeem it again — the funds went to whoever redeemed it first.
        </p>
      </div>
    </div>
  );
}
