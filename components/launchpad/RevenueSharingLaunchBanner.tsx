"use client";

import { TrendingUp } from "lucide-react";
import { formatPlatformFeeLabel } from "@/lib/constants/launchpad";
import { feeShareLabels } from "@/lib/launchpad/fee-split";

export default function RevenueSharingLaunchBanner() {
  const shares = feeShareLabels();

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
          <TrendingUp size={20} className="text-emerald-700" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800">
            Creator revenue · built in
          </p>
          <h3 className="mt-1 text-base font-bold text-[var(--ink)]">
            You keep {shares.creator} of swap fees — paid on every trade
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]">
            Launch for <strong className="text-[var(--ink)]">$0</strong> (gas only). When traders
            swap your token in Base Analytics, a {formatPlatformFeeLabel()} fee splits{" "}
            <strong className="text-[var(--ink)]">{shares.creator} to you</strong>,{" "}
            {shares.referrer} to referrers, {shares.platform} to the platform — instantly to your
            wallet, no claim step.
          </p>
          <p className="mt-2 text-[11px] text-[var(--ink-dim)]">
            Sign in after connect to manage your public creator profile and fee history.
          </p>
        </div>
      </div>
    </div>
  );
}
