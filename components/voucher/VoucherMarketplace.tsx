"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, Sparkles } from "lucide-react";
import type { VoucherBatchMeta } from "@/lib/types/voucher";
import { formatVoucherAmount, type VoucherAsset } from "@/lib/utils/voucher";

function formatBatchAmount(asset: VoucherAsset, amountStr: string): string {
  try {
    return formatVoucherAmount(asset, BigInt(amountStr));
  } catch {
    return amountStr;
  }
}

export default function VoucherMarketplace() {
  const [batches, setBatches] = useState<VoucherBatchMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/vouchers")
      .then((r) => r.json())
      .then((d) => setBatches((d.batches ?? []).slice(0, 24)))
      .catch(() => setBatches([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-28 rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse" />
    );
  }

  if (batches.length === 0) return null;

  const open = batches.filter((b) => b.cardCount > (b.redeemedCount ?? 0));

  return (
    <section className="page-hero overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Gift size={16} className="text-emerald-300 shrink-0" />
          <div className="min-w-0">
            <p className="section-eyebrow text-emerald-300/90">Live marketplace</p>
            <p className="readable-body text-xs mt-0.5">
              {open.length} open batch{open.length === 1 ? "" : "es"} with cards available
            </p>
          </div>
        </div>
        <Link
          href="/redeem"
          className="shrink-0 text-[11px] font-bold text-emerald-300 hover:text-white transition"
        >
          Redeem →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar touch-scroll-x -mx-1 px-1 pb-1">
        {open.slice(0, 12).map((b) => {
          const left = b.cardCount - (b.redeemedCount ?? 0);
          return (
            <div
              key={`${b.batchId}-${b.creator}`}
              className="shrink-0 w-[min(200px,72vw)] rounded-2xl border border-white/10 bg-black/30 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={12} className="text-emerald-400" />
                <span className="text-[10px] font-black text-emerald-300 uppercase">
                  {b.asset}
                </span>
              </div>
              <p className="text-lg font-black text-white font-mono">
                {formatBatchAmount(b.asset, b.amountPerCard)}
              </p>
              <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                {b.message || "Base gift card"}
              </p>
              <p className="text-[10px] text-slate-400 mt-2">{left} cards left</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
