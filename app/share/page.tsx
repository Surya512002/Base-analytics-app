import type { Metadata } from "next";
import Link from "next/link";
import { APP_URL_WEB } from "@/lib/constants/env";
import { getOgImageUrl } from "@/lib/og/types";

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
    score: parseInt(score, 10) || 88,
    rank,
    badges: parseInt(badges, 10) || 0,
    days: parseInt(pick(params, "days"), 10) || undefined,
    xp: parseInt(pick(params, "xp"), 10) || undefined,
    streak: parseInt(pick(params, "streak"), 10) || undefined,
    title: pick(params, "title") || undefined,
    subtitle: pick(params, "subtitle") || undefined,
    variant: (pick(params, "v") as "default" | "score" | "badge" | "referral") || "score",
  });

  const title = pick(params, "title") || `${rank} — ${score}/100 on Base Analytics`;
  const description =
    pick(params, "subtitle") ||
    `Onchain score ${score}/100 · ${badges} badges · Season 1: Genesis on Base`;

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
  const rank = pick(params, "rank") || "Base God 👑";
  const ref = pick(params, "ref");

  return (
    <main className="min-h-screen bg-[#071220] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] btn-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="relative z-10 max-w-md w-full text-center space-y-8">
        <div>
          <p className="text-[10px] font-black text-cyan-400/60 uppercase tracking-[0.35em] mb-3">
            Base Analytics
          </p>
          <h1 className="text-4xl font-black tracking-tight">
            <span className="text-cyan-400 text-sm font-extrabold tracking-[0.25em] uppercase block mb-2">
              Onchain Score
            </span>
            <span className="text-gradient-blue">{score}</span>
            <span className="text-white/25">/100</span>
          </h1>
          <p className="text-white font-bold mt-2 text-lg">{rank}</p>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed">
          Can you beat this score? Free wallet scan — mint gasless badges and climb
          the Season 1 leaderboard on Base.
        </p>
        <Link
          href={ref ? `/?ref=${ref}` : "/"}
          className="inline-flex items-center justify-center w-full py-4 rounded-2xl font-black text-base text-white btn-primary"
        >
          Challenge Me — Get My Score →
        </Link>
      </div>
    </main>
  );
}
