"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import VoucherGiftHero from "@/components/voucher/VoucherGiftHero";
import VoucherHowItWorks from "@/components/voucher/VoucherHowItWorks";
import { parseCampaignLink } from "@/lib/voucher/campaign";

/** Vouchers before a wallet is connected: what it does, and the next step. */
export default function VoucherGuestView({ onConnect }: { onConnect: () => void }) {
  const router = useRouter();
  // Someone who opened a shared gift link needs to hear that first.
  const [hasGift, setHasGift] = useState(false);
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    setHasGift(Boolean(parseCampaignLink({ pathname, search, hash }).campaignId));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <section className="flex flex-col gap-3 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-[var(--ink)]">{hasGift ? "You've been sent a gift" : "Connect a wallet to send or claim gifts"}</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            {hasGift ? "Connect a wallet on Base to claim it." : "Got a card ID and secret? You can start claiming on the redeem page."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onConnect} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-white">
            <Wallet size={15} aria-hidden /> Connect wallet
          </button>
          {!hasGift && (
            <button type="button" onClick={() => router.push("/redeem")} className="min-h-[44px] cursor-pointer rounded-xl border border-[var(--border-subtle)] px-5 text-sm font-bold text-[var(--ink)]">
              Redeem a card
            </button>
          )}
        </div>
      </section>

      <VoucherGiftHero view="create" onNavigate={(v) => (v === "redeem" && !hasGift ? router.push("/redeem") : onConnect())} />
      <VoucherHowItWorks />
    </div>
  );
}
