import type { Metadata } from "next";
import Link from "next/link";
import { APP_URL_WEB } from "@/lib/constants/env";
import { getOgImageUrl } from "@/lib/og/types";
import { SHARE_HASHTAGS, SHARE_TAGLINE } from "@/lib/utils/share";

const APP_URL = APP_URL_WEB;

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pick(
  params: Record<string, string | string[] | undefined>,
  key: string
): string {
  const v = params[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const score = pick(params, "score") || "88";
  const rank = pick(params, "rank") || "Base God";
  const badges = pick(params, "badges") || "0";
  const ogImage = getOgImageUrl(APP_URL, {
    score: parseInt(score, 10) || 72,
    rank,
    badges: parseInt(badges, 10) || 0,
    days: parseInt(pick(params, "days"), 10) || undefined,
    xp: parseInt(pick(params, "xp"), 10) || undefined,
    streak: parseInt(pick(params, "streak"), 10) || undefined,
    title: pick(params, "title") || undefined,
    subtitle: pick(params, "subtitle") || undefined,
    variant: (pick(params, "v") as "default" | "score" | "badge" | "referral") || "score",
    address: pick(params, "addr") || undefined,
    activeDays: parseInt(pick(params, "activeDays"), 10) || undefined,
    txs: parseInt(pick(params, "txs"), 10) || undefined,
    healthScore: parseInt(pick(params, "health"), 10) || undefined,
    boosts: parseInt(pick(params, "boosts"), 10) || undefined,
  });

  const title = pick(params, "title") || `${rank} — ${score}/100 on Base Analytics`;
  const description =
    pick(params, "subtitle") ||
    `Onchain score ${score}/100 · ${badges} badges · ${SHARE_TAGLINE}`;

  const sharePath = `/share?${new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || ""])
    )
  ).toString()}`;

  return {
    title,
    description,
    metadataBase: new URL(APP_URL),
    openGraph: {
      title,
      description,
      url: `${APP_URL}${sharePath}`,
      siteName: "Base Analytics",
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function SharePage({ searchParams }: Props) {
  const params = await searchParams;
  const score = pick(params, "score") || "88";
  const rank = pick(params, "rank") || "Base God";
  const badges = pick(params, "badges") || "0";
  const ref = pick(params, "ref");

  return (
    <main className="share-challenge-page text-white flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none" />
      <div className="relative z-10 w-full max-w-lg">
        <div className="text-center mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--ink-dim)] mb-4">
            Base Analytics · On Base
          </p>
          <div className="inline-flex items-center gap-2 spotlight-badge mb-6">
            <span className="live-dot" style={{ width: 6, height: 6 }} />
            Challenge card
          </div>
        </div>

        <div className="rounded-2xl border border-white/12 bg-[var(--bg-raised)]/90 backdrop-blur-sm overflow-hidden shadow-2xl">
          <div className="h-1 bg-linear-to-r from-[#0052FF] via-[#6BA3FF] to-emerald-500" />
          <div className="p-8 sm:p-10 text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)] mb-3">
              Onchain Score
            </p>
            <p className="share-score-ring text-white">
              {score}
              <span className="text-2xl sm:text-3xl text-white/30 font-bold">/100</span>
            </p>
            <p className="text-xl sm:text-2xl font-bold text-white mt-3">{rank}</p>
            {badges !== "0" && (
              <p className="text-[13px] text-[var(--ink-muted)] mt-2">
                {badges} badges minted on Base
              </p>
            )}
          </div>
          <div className="px-8 pb-8 sm:px-10 sm:pb-10 space-y-4">
            <p className="readable-body text-center text-[14px]">
              Explore B20 tokens, swap Uniswap &amp; Aerodrome in-app with USD quotes, and scan your
              wallet — all without leaving Base Analytics.
            </p>
            <p className="text-[11px] text-center text-[var(--ink-dim)]">{SHARE_TAGLINE}</p>
            <p className="text-[11px] text-center text-[#6BA3FF] font-semibold">{SHARE_HASHTAGS}</p>
            <Link
              href={ref ? `/?ref=${ref}` : "/"}
              className="btn-primary flex items-center justify-center w-full min-h-[52px] py-4 rounded-xl font-bold text-[15px] transition-colors"
            >
              Accept challenge — get my score →
            </Link>
          </div>
        </div>

        <p className="text-center text-[12px] text-[var(--ink-dim)] mt-6">
          B20 launchpad · in-app DEX · quests &amp; badges on Base
        </p>
      </div>
    </main>
  );
}
