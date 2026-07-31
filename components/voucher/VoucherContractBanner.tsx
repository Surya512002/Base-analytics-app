"use client";

import { AlertCircle, CheckCircle } from "lucide-react";
import { VOUCHER_CONTRACT } from "@/lib/constants/env";
import SectionCard from "@/components/ui/SectionCard";

export default function VoucherContractBanner({ contractReady }: { contractReady: boolean }) {
  if (!contractReady) {
    return (
      <SectionCard bar={false}>
        <div className="flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span className="readable-body text-xs">
            Set <code className="text-amber-900 font-bold">NEXT_PUBLIC_VOUCHER_CONTRACT</code> in{" "}
            <code className="text-amber-900 font-bold">.env.local</code> to enable vouchers.
          </span>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="flex justify-end">
      <a
        href={`https://basescan.org/address/${VOUCHER_CONTRACT}#code`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)]"
      >
        <CheckCircle size={12} /> Verified contract on Basescan ↗
      </a>
    </div>
  );
}
