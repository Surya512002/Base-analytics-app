"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, Wallet } from "lucide-react";
import { buildSenderIdentity, type SenderIdentity as SenderIdentityT } from "@/lib/voucher/campaign";
import { resolveBasenameClient } from "@/lib/utils/resolve-basename";
import { SenderIdentity } from "@/components/voucher/CampaignTrust";

/**
 * Verified sender identity for a wallet: its own Basename (reverse-resolved, so it can't be
 * faked) plus the full address. Null until an address is known.
 */
export function useSenderIdentity(address: string | null | undefined, label = ""): SenderIdentityT | null {
  const [basename, setBasename] = useState<{ for: string; name: string | null } | null>(null);
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    resolveBasenameClient(address as `0x${string}`)
      .then((n) => !cancelled && setBasename({ for: address.toLowerCase(), name: n ?? null }))
      .catch(() => !cancelled && setBasename({ for: address.toLowerCase(), name: null }));
    return () => {
      cancelled = true;
    };
  }, [address]);
  if (!address) return null;
  const name = basename?.for === address.toLowerCase() ? basename.name : null;
  return buildSenderIdentity(address, label, name);
}

/** In the create wizard: exactly what recipients will see as the sender, for both gift kinds. */
export function SenderPreviewCard({ address }: { address: string | null | undefined }) {
  const sender = useSenderIdentity(address);
  if (!sender) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3.5 text-xs text-[var(--ink-muted)]">
        <Wallet size={16} /> Connect your wallet to see how recipients will identify you.
      </div>
    );
  }
  const verified = sender.trust === "basename-verified";
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3.5 text-xs">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ink-muted)]">Recipients will see</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="text-sm font-black text-[var(--ink)]">{sender.basename ?? "Your wallet address"}</span>
        {verified ? (
          <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
            <BadgeCheck size={13} /> Verified Basename
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
            <AlertTriangle size={13} /> No Basename: recipients identify you by address
          </span>
        )}
      </div>
      <p className="mt-1 break-all font-mono text-[11px] text-[var(--ink-muted)]">{sender.address}</p>
      <p className="mt-1.5 text-[11px] text-[var(--ink-dim)]">
        Your wallet address is recorded by the contract when you fund the gift, so it can&apos;t be faked.
      </p>
    </div>
  );
}

/** On the claim screen for a personal gift: the same "Sent by" card one-link gifts show. */
export function PersonalGiftSender({ creator }: { creator: string }) {
  const sender = useSenderIdentity(creator);
  return sender ? <SenderIdentity sender={sender} /> : null;
}
