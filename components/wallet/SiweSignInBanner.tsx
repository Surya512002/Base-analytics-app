"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { feeShareLabels } from "@/lib/launchpad/fee-split";
import { formatPlatformFeeLabel } from "@/lib/constants/launchpad";

export default function SiweSignInBanner({
  walletAddress,
  authenticated,
  signingIn,
  onSignIn,
  compact,
}: {
  walletAddress: string;
  authenticated: boolean;
  signingIn?: boolean;
  onSignIn: () => void;
  compact?: boolean;
}) {
  if (authenticated) return null;

  const shares = feeShareLabels();

  if (compact) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        disabled={signingIn}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-500/15 disabled:opacity-60"
      >
        {signingIn ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
        Sign in
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand-soft)]/50 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand-dark)]">
            One quick signature
          </p>
          <h3 className="mt-1 text-base font-bold text-[var(--ink)]">
            Sign in to launch & track creator revenue
          </h3>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Connected as{" "}
            <span className="font-mono text-[var(--ink)]">
              {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </span>
            . Sign a free message (no gas) to secure your profile and fee dashboard — like o1
            launchpad.
          </p>
          <p className="mt-2 text-[11px] text-[var(--ink-dim)]">
            Creators earn <strong className="text-[var(--ink)]">{shares.creator}</strong> of every{" "}
            {formatPlatformFeeLabel()} swap fee · referrers get {shares.referrer} · paid instantly
            on each trade.
          </p>
        </div>
        <button
          type="button"
          onClick={onSignIn}
          disabled={signingIn}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-bold text-white hover:bg-[var(--brand-dark)] disabled:opacity-60 sm:w-auto touch-manipulation"
        >
          {signingIn ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Signing…
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              Sign in with wallet
            </>
          )}
        </button>
      </div>
    </div>
  );
}
