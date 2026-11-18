"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import GiftClaimStage from "@/components/voucher/GiftClaimStage";
import { EligibilityChecklist, OwnershipTerms, SenderIdentity } from "@/components/voucher/CampaignTrust";
import AppLogo from "@/components/ui/AppLogo";
import { parseCampaignLink } from "@/lib/voucher/campaign";
import type { CampaignPublicView } from "@/lib/voucher/campaign-server";

/**
 * Short claim link: /claim/:id#k=SECRET
 * Shows the gift box, who sent it (before any wallet is connected) and how many gifts are left,
 * then hands off to the in-app claim, where the same box opens once the claim is confirmed.
 * The secret stays in the fragment, so it is never sent to our server.
 */
function ClaimLanding({ id }: { id: string }) {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [view, setView] = useState<CampaignPublicView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const parsed = parseCampaignLink({ pathname: window.location.pathname, hash: window.location.hash });
    setSecret(parsed.secret);
  }, []);

  useEffect(() => {
    fetch(`/api/voucher/campaign/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || "Gift not found");
        setView(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gift not found"));
  }, [id]);

  const href = `/?tab=basehub&view=campaign#camp=${encodeURIComponent(id)}${secret ? `&k=${encodeURIComponent(secret)}` : ""}`;
  const unavailable =
    !view || view.status === "full" || view.status === "expired" || view.status === "closed"
      ? !view
        ? error || null
        : view.status === "full"
          ? "Every gift in this link has been claimed"
          : view.status === "expired"
            ? "This gift has expired"
            : "This gift was returned to the sender"
      : !secret
        ? "This link is missing its key: ask the sender for the full link"
        : null;

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--ink)]">
      <div className="mx-auto max-w-lg space-y-5 px-4 py-8 sm:py-12">
        <Link href="/" className="flex items-center gap-3">
          <AppLogo size="md" />
          <span className="text-lg font-black uppercase tracking-[0.15em]">Base Analytics</span>
        </Link>

        <h1 className="text-center text-2xl font-black sm:text-3xl">
          You&apos;ve been sent <span className="shiny-text">a gift</span>
        </h1>

        <GiftClaimStage
          status={!view && !error ? "loading" : unavailable ? "unavailable" : "ready"}
          statusText={unavailable ?? undefined}
          kindLabel="One-link gift"
          amountLabel={view?.perClaimFormatted ?? "a gift"}
          claimLabel={view ? `Claim ${view.perClaimFormatted}` : undefined}
          message={view?.message}
          sender={view?.sender}
          left={view?.claimsRemaining}
          total={view?.maxClaims}
          unlockAt={view?.status === "locked" ? view.unlockAt : undefined}
          expiresAt={view?.expiresAt || undefined}
          onTap={() => router.push(href)}
        />

        {view && (
          <div className="hero-card space-y-4 rounded-3xl p-5">
            <SenderIdentity sender={view.sender} />
            <OwnershipTerms view={view} />
            <EligibilityChecklist campaignId={view.campaignId} wallet={undefined} />
          </div>
        )}

        <div className="space-y-2 text-center">
          <p className="text-[11px] text-[var(--ink-dim)]">
            You&apos;ll connect your wallet next. The claim is one transaction on Base.
          </p>
          <Link href="/?tab=basehub" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--ink)]">
            Send your own gift <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <ClaimLanding id={id.replace(/\D/g, "").slice(0, 12)} />
    </Suspense>
  );
}
