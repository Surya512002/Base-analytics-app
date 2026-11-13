"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, CheckCircle2, Copy, ExternalLink, MinusCircle, XCircle } from "lucide-react";
import type { CampaignPublicView, EligibilityResult } from "@/lib/voucher/campaign-server";

const fmt = (sec: number) => new Date(sec * 1000).toLocaleString();

/** Sender identity: name (verified or not) AND the full onchain address, always both. */
export function SenderIdentity({ sender }: { sender: CampaignPublicView["sender"] }) {
  const [copied, setCopied] = useState(false);
  const verified = sender.trust === "basename-verified";
  const name = sender.basename ?? (sender.label || null);

  return (
    <div
      className={`rounded-2xl border p-4 space-y-3 ${
        verified ? "border-emerald-500/30 bg-emerald-500/8" : "border-amber-500/30 bg-amber-500/8"
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ink-muted)]">Sent by</p>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-dim)]">Name</p>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          <span className="text-lg font-black text-[var(--ink)] break-all">{name ?? "No name set"}</span>
          {verified ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500">
              <BadgeCheck size={14} /> Verified Basename of this wallet
            </span>
          ) : name ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500">
              <AlertTriangle size={14} /> Typed by the sender — not verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500">
              <AlertTriangle size={14} /> Identify the sender by address
            </span>
          )}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-dim)]">Creator wallet address</p>
        <p className="font-mono text-sm text-[var(--ink)] break-all mt-0.5">{sender.address}</p>
        <div className="flex gap-3 mt-1.5 text-[11px] font-bold">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[var(--brand)]"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(sender.address);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* clipboard blocked */
              }
            }}
          >
            <Copy size={11} /> {copied ? "Copied" : "Copy address"}
          </button>
          <a
            href={sender.basescanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--brand)]"
          >
            View on Basescan <ExternalLink size={11} />
          </a>
        </div>
      </div>

      <p className="text-[11px] text-[var(--ink-dim)]">
        The address is recorded by the contract when the gift is funded and can&apos;t be faked. Compare it with the
        address you know for this person. Never claim if a message asks you to pay, connect somewhere else, or share a
        seed phrase.
      </p>
    </div>
  );
}

/** Who owns the assets before acceptance, when it expires, and how refunds work. */
export function OwnershipTerms({ view }: { view: CampaignPublicView }) {
  const rows: Array<[string, string]> = [
    [
      "Who owns it right now",
      view.status === "closed"
        ? "This gift is closed: every unclaimed share has already been returned to the sender's wallet. Shares claimed earlier belong to the people who claimed them."
        : view.status === "full"
          ? "Every share has been claimed and now belongs to the wallets that claimed it."
          : `Until you claim, the ${view.asset.symbol} sits in the BaseVoucherCampaign contract (${view.contract.slice(0, 6)}…${view.contract.slice(-4)}) as escrow for the sender. It becomes yours only when your claim transaction confirms.`,
    ],
    [
      "When it opens",
      view.unlockAt > 0 ? `Claims open ${fmt(view.unlockAt)}.` : "Claimable now.",
    ],
    [
      "When unclaimed gifts expire",
      view.expiresAt > 0
        ? `${fmt(view.expiresAt)}. After that nobody can claim, and the sender can take back every unclaimed share.`
        : "No expiry. Unclaimed shares stay in escrow until the sender cancels and takes them back.",
    ],
    [
      "If you can't legally receive it",
      "The claim is refused before anything moves. Your share never leaves escrow and goes back to the sender when the gift is closed or expires.",
    ],
    [
      "Can the sender take it back?",
      view.committed
        ? `Not before ${fmt(view.expiresAt)} — the sender committed this gift onchain. After that, only unclaimed shares.`
        : "Yes — the sender can cancel at any time and take back unclaimed shares. Claimed shares are yours and can't be taken back.",
    ],
  ];
  if (view.asset.regulated) {
    rows.push([
      "About tokenized stocks",
      "This is a third-party token that tracks a stock. It doesn't give you shareholder or voting rights, availability depends on your region, and this isn't investment advice.",
    ]);
  }
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ink-muted)] mb-2">
        Ownership, expiry &amp; refunds
      </p>
      <dl className="space-y-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-bold text-[var(--ink)]">{k}</dt>
            <dd className="text-xs text-[var(--ink-muted)]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Fetches and shows the recipient's pre-claim eligibility. Reports the result upward. */
export function EligibilityChecklist({
  campaignId,
  wallet,
  onResult,
  refreshKey = 0,
}: {
  campaignId: string;
  wallet: string | undefined;
  onResult?: (r: EligibilityResult | null) => void;
  refreshKey?: number;
}) {
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const q = wallet ? `?wallet=${encodeURIComponent(wallet)}` : "";
    fetch(`/api/voucher/campaign/${campaignId}/eligibility${q}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || "Eligibility check failed");
        return d as EligibilityResult;
      })
      .then((d) => {
        if (cancelled) return;
        setError("");
        setResult(d);
        onResult?.(d);
      })
      .catch((e) => {
        if (cancelled) return;
        setResult(null);
        setError(e instanceof Error ? e.message : "Eligibility check failed");
        onResult?.(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, wallet, refreshKey]);

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ink-muted)]">
          Can {wallet ? "this wallet" : "you"} claim?
        </p>
        {result && (
          <span className={`text-xs font-black ${result.eligible ? "text-emerald-500" : "text-red-400"}`}>
            {result.eligible ? "Eligible" : "Not eligible"}
          </span>
        )}
      </div>
      {!result && !error && <p className="text-xs text-[var(--ink-dim)] animate-pulse">Checking…</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {result && (
        <ul className="space-y-1.5">
          {result.checks.map((c) => (
            <li key={c.id} className="flex gap-2 text-xs">
              {c.result === "pass" ? (
                <CheckCircle2 size={14} className="shrink-0 text-emerald-500 mt-0.5" />
              ) : c.result === "fail" ? (
                <XCircle size={14} className="shrink-0 text-red-400 mt-0.5" />
              ) : (
                <MinusCircle size={14} className="shrink-0 text-[var(--ink-dim)] mt-0.5" />
              )}
              <span>
                <span className="font-bold text-[var(--ink)]">{c.label}</span>
                <span className="text-[var(--ink-muted)]"> — {c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {!wallet && result && (
        <p className="text-[11px] text-[var(--ink-dim)] mt-2">Connect a wallet to run the wallet-specific checks.</p>
      )}
    </div>
  );
}
