"use client";

import Link from "next/link";
import { Gift } from "lucide-react";
import { buildGiftVoucherDeepLink } from "@/lib/utils/app-url";

export default function QuickGiftCta({
  recipientAddress,
  guest,
  onConnect,
  compact,
}: {
  recipientAddress?: string;
  guest?: boolean;
  onConnect?: () => void;
  compact?: boolean;
}) {
  const href = buildGiftVoucherDeepLink("5");
  const payHref = recipientAddress ? `/pay/${recipientAddress}` : null;

  return (
    <div
      className={`pop rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] ${
        compact ? "p-3" : "p-4"
      } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
    >
      <div className="flex items-start gap-2 min-w-0">
        <Gift size={18} className="text-emerald-300 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-[var(--ink)]">Send a $5 USDC gift card</p>
          <p className="readable-body text-xs mt-0.5">
            One tap to create a voucher on Base — share with anyone.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {guest ? (
          <button
            type="button"
            onClick={onConnect}
            className="pop-pill min-h-[40px] px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-[12px] font-bold text-emerald-800 dark:text-emerald-100 transition-colors cursor-pointer"
          >
            Connect to gift
          </button>
        ) : (
          <Link
            href={href}
            className="pop-pill min-h-[40px] px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-[12px] font-bold text-emerald-800 dark:text-emerald-100 inline-flex items-center transition-colors cursor-pointer"
          >
            Gift $5 USDC
          </Link>
        )}
        {payHref && (
          <Link
            href={payHref}
            className="pop-pill min-h-[40px] px-4 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--brand)] text-[12px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] inline-flex items-center transition-colors cursor-pointer"
          >
            Pay link
          </Link>
        )}
      </div>
    </div>
  );
}
