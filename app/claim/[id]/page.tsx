"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import GiftBox from "@/components/ui/motion/GiftBox";
import { EligibilityChecklist, OwnershipTerms, SenderIdentity } from "@/components/voucher/CampaignTrust";
import AppLogo from "@/components/ui/AppLogo";
import { parseCampaignLink } from "@/lib/voucher/campaign";
import type { CampaignPublicView } from "@/lib/voucher/campaign-server";

/**
 * Short claim link: /claim/:id#k=SECRET
 * Shows who sent the gift (before any wallet is connected) and how many slots are left, then
 * hands off to the in-app claim flow. The secret stays in the fragment — it is never sent to our server.
 */
function ClaimLanding({ id }: { id: string }) {
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
        if (!r.ok) throw new Error(d?.error || "Campaign not found");
        setView(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Campaign not found"));
  }, [id]);

  const href = `/?tab=basehub&view=campaign#camp=${encodeURIComponent(id)}${secret ? `&k=${encodeURIComponent(secret)}` : ""}`;

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--ink)]">
      <div className="max-w-lg mx-auto px-4 py-12 space-y-6">
        <div className="flex items-center gap-3">
          <AppLogo size="md" />
          <span className="font-black text-lg tracking-[0.15em] uppercase">Base Analytics</span>
        </div>

        <div className="hero-card rounded-3xl p-6 space-y-4">
          <div className="flex flex-col items-center gap-1 pt-2 text-center">
            {/* Opens once the gift has loaded, revealing the real amount */}
            <GiftBox
              key={view ? "loaded" : "loading"}
              size={200}
              autoOpen={Boolean(view)}
              cardLabel="GIFT"
              cardValue={view ? view.perClaimFormatted : "On Base"}
            />
            <h1 className="text-2xl font-black">
              You&apos;ve been sent <span className="shiny-text">a gift</span>
            </h1>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {!view && !error && <p className="text-sm text-[var(--ink-dim)] animate-pulse">Reading campaign from Base…</p>}

          {view && (
            <>
              <SenderIdentity sender={view.sender} />
              <p className="text-3xl font-black">{view.perClaimFormatted}</p>
              {view.message && <p className="italic text-sm text-[var(--ink-muted)]">&ldquo;{view.message}&rdquo;</p>}
              <p className="text-sm text-[var(--ink-muted)]">
                {view.claimsRemaining} of {view.maxClaims} claims left · {view.status}
              </p>
              <OwnershipTerms view={view} />
              <EligibilityChecklist campaignId={view.campaignId} wallet={undefined} />
              {view.status === "open" ? (
                <Link
                  href={href}
                  className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-black btn-primary text-white"
                >
                  Connect wallet &amp; claim <ArrowRight size={16} />
                </Link>
              ) : (
                <p className="w-full py-4 rounded-2xl text-center font-black border border-[var(--border-subtle)] text-[var(--ink-muted)]">
                  {view.status === "full"
                    ? "All claims have been taken"
                    : view.status === "locked"
                      ? `Opens ${new Date(view.unlockAt * 1000).toLocaleString()} — check back then`
                      : `This campaign is ${view.status}`}
                </p>
              )}
              {!secret && view.status === "open" && (
                <p className="text-xs text-amber-500">
                  This link has no secret key — you&apos;ll need the full link from the sender to claim.
                </p>
              )}
            </>
          )}
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
