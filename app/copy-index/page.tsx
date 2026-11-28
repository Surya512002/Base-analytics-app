import type { Metadata } from "next";
import Link from "next/link";
import { Layers } from "lucide-react";
import AppFooterNav from "@/components/wallet/AppFooterNav";
import AppLogo from "@/components/ui/AppLogo";
import { getAppUrl } from "@/lib/constants/app-url";
import { INDEX_HREF } from "@/lib/constants/destinations";
import { BASE_OFFICIAL_STOCKS } from "@/lib/stocks/base-verified";
import { decodeIndex, encodeIndex } from "@/lib/stocks/index-link";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const NAMES = new Map(BASE_OFFICIAL_STOCKS.map((s) => [s.symbol, s.name]));

async function read(searchParams: Props["searchParams"]) {
  const params = await searchParams;
  return decodeIndex({ get: (name) => (typeof params[name] === "string" ? (params[name] as string) : null) });
}

/** The page a shared index link opens: its preview card, what is in it, and one button to copy it. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const shared = await read(searchParams);
  const title = "A stock index on Base";
  const description = shared
    ? `${Object.keys(shared.weights).join(", ")}. Copy it and change what you like on Base Analytics.`
    : "Build your own stock index on Base Analytics.";
  const images = shared ? [{ url: `${getAppUrl()}/api/og?v=index&${encodeIndex(shared)}`, width: 1200, height: 630, alt: title }] : undefined;
  return {
    title: `${title} | Base Analytics`,
    description,
    // Anyone can make these links, so search engines shouldn't list them.
    robots: { index: false },
    openGraph: { title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function CopyIndexPage({ searchParams }: Props) {
  const shared = await read(searchParams);
  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--ink)]">
      <main className="app-container flex-1 py-6 sm:py-10">
        <div className="mx-auto mb-4 w-full max-w-xl">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-black">
            <AppLogo size="sm" /> Base Analytics
          </Link>
        </div>
        <section className="mx-auto w-full max-w-xl space-y-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
          <h1 className="flex items-center gap-2 text-xl font-black">
            <Layers size={20} aria-hidden className="text-[var(--brand-text)]" /> A stock index on Base
          </h1>
          {shared ? (
            <>
              <p className="text-sm text-[var(--ink-muted)]">
                At least {shared.rules.cashPct}% kept as cash, and no company above {shared.rules.maxPct}%.
              </p>
              <ul className="space-y-2">
                {Object.entries(shared.weights).map(([symbol, pct]) => (
                  <li key={symbol} className="space-y-1">
                    <span className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        <b>{symbol}</b> <span className="text-[var(--ink-muted)]">{NAMES.get(symbol)}</span>
                      </span>
                      <b className="tabular-nums">{pct}%</b>
                    </span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <span className="block h-full rounded-full bg-[var(--brand)]" style={{ width: `${pct}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
              <Link href={`${INDEX_HREF}&${encodeIndex(shared)}`} className="btn-primary flex min-h-12 items-center justify-center rounded-2xl text-[15px] font-bold">
                Copy this index
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--ink-muted)]">This link doesn&apos;t hold a complete index. You can build your own.</p>
              <Link href={INDEX_HREF} className="btn-primary flex min-h-12 items-center justify-center rounded-2xl text-[15px] font-bold">
                Build an index
              </Link>
            </>
          )}
          <p className="text-xs text-[var(--ink-muted)]">
            The person who shared this chose the weights. Not investment advice. Tokenized stocks aren&apos;t available in every region.
          </p>
        </section>
      </main>
      <AppFooterNav />
    </div>
  );
}
