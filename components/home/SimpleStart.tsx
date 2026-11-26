"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  CalendarClock,
  CandlestickChart,
  ChevronRight,
  CircleDollarSign,
  Compass,
  Gift,
  Landmark,
  List,
  PackageOpen,
  PieChart,
  Rocket,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  Vault,
  type LucideIcon,
} from "lucide-react";
import TokenLogo from "@/components/ui/TokenLogo";
import SafetyNote from "@/components/ui/SafetyNote";
import { useStockMarkets } from "@/hooks/useMarketsData";
import { AUTO_INVEST_HREF, STOCK_LIST_HREF } from "@/lib/constants/destinations";
import { mostTraded } from "@/lib/markets/most-traded";
import { GROUPS } from "@/lib/nav/directory";

const ACTIONS = [
  { href: "/trade", title: "Buy a stock", note: "Pick one and pay with USDC or ETH" },
  { href: AUTO_INVEST_HREF, title: "Invest every week", note: "Set it once, cancel any time" },
  { href: "/lend", title: "Earn or borrow", note: "Put the stocks you hold to work" },
] as const;

const QUICK = [
  { href: "/?tab=basehub", title: "Send a gift", icon: Gift },
  { href: "/launch", title: "Launch a token", icon: Rocket },
] as const;

const ICONS: Record<string, LucideIcon> = {
  stocks: List,
  tokens: Compass,
  swap: ArrowLeftRight,
  orders: Target,
  "auto-invest": CalendarClock,
  chart: CandlestickChart,
  lend: Landmark,
  vaults: Vault,
  compare: Scale,
  "send-gift": Gift,
  "receive-gift": PackageOpen,
  drops: Sparkles,
  holdings: PieChart,
  creator: CircleDollarSign,
  launch: Rocket,
};

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const list = "divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]";

/** Home: the main things to do, today's most traded stocks, then everything in the app. */
export default function SimpleStart() {
  const { stocks, loading } = useStockMarkets();
  const popular = mostTraded(stocks, 3);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 pb-8">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-10">
        <div className="relative isolate space-y-3">
          <span aria-hidden className="home-rosette"><span /></span>
          <h2 className="max-w-[16rem] pb-3 pt-2 text-[2rem] font-bold leading-[1.1] text-[var(--ink)] sm:max-w-sm sm:text-[2.5rem]">
            What would you like to do?
          </h2>
          <nav aria-label="Start here" className="grid grid-cols-2 gap-3">
            {ACTIONS.map((a, i) => (
              <Link
                key={a.href}
                href={a.href}
                className={`flex min-h-[84px] flex-col justify-center gap-1 rounded-2xl border px-4 py-3 transition active:scale-[0.98] ${
                  i === 0
                    ? "col-span-2 border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]"
                    : "border-[var(--edge)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--brand)]"
                }`}
              >
                <span className="text-[17px] font-bold">{a.title}</span>
                <span className={`text-[13px] ${i === 0 ? "text-white" : "text-[var(--ink-muted)]"}`}>{a.note}</span>
              </Link>
            ))}
            {QUICK.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-[10px] border border-[var(--edge)] bg-[var(--surface)] px-2 text-center text-[15px] font-bold text-[var(--ink)] transition hover:border-[var(--brand)] active:scale-[0.98]"
              >
                <q.icon size={18} aria-hidden className="shrink-0 text-[var(--brand-text)]" />
                {q.title}
              </Link>
            ))}
          </nav>
        </div>

        <section aria-labelledby="popular-today" className="space-y-2 lg:pt-2">
          <div className="flex items-center justify-between gap-3">
            <h3 id="popular-today" className="text-[21px] font-bold text-[var(--ink)]">Popular today</h3>
            <Link href={STOCK_LIST_HREF} className="flex min-h-[44px] items-center text-[13px] font-bold text-[var(--brand-text)]">
              See all stocks
            </Link>
          </div>
          <ul className={list}>
            {popular.map((s) => (
              <li key={s.address}>
                <Link href={`/trade?token=${s.address}`} className="flex min-h-[64px] items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)]">
                  <TokenLogo address={s.address} symbol={s.symbol} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-[var(--ink)]">{s.name}</span>
                    <span className="block text-[13px] text-[var(--ink-muted)]">{s.symbol}</span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block text-[15px] font-bold text-[var(--ink)]">{usd(s.price)}</span>
                    {/* The feed sends 0 when it has no change figure, so 0 is not shown. */}
                    {s.change24h !== 0 && (
                      <span className={`block text-[13px] font-bold ${s.change24h > 0 ? "text-[var(--success-text)]" : "text-[var(--danger-text)]"}`}>
                        {s.change24h > 0 ? "+" : ""}
                        {s.change24h.toFixed(2)}% today
                      </span>
                    )}
                  </span>
                  <ChevronRight size={16} aria-hidden className="shrink-0 text-[var(--ink-dim)]" />
                </Link>
              </li>
            ))}
            {popular.length === 0 && (
              <li role="status" className="px-4 py-6 text-center text-[13px] text-[var(--ink-muted)]">
                {loading ? "Loading prices…" : "Prices are not available right now."}
              </li>
            )}
          </ul>
        </section>
      </div>

      <section aria-labelledby="everything">
        <h3 id="everything" className="pb-3 text-[21px] font-bold text-[var(--ink)]">Everything in the app</h3>
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {GROUPS.filter((g) => g.id !== "help").map((group) => (
            <div key={group.id}>
              <h4 className="pb-2 text-[17px] font-bold text-[var(--ink)]">{group.title}</h4>
              <ul className={list}>
                {group.entries.map((e, i) => {
                  const Icon = ICONS[e.id] ?? Compass;
                  return (
                    <li key={e.id}>
                      <Link href={e.href} className="flex min-h-[64px] items-center gap-3 px-3.5 py-2.5 hover:bg-[var(--surface-2)]">
                        <span aria-hidden className={`seal ${group.id === "gifts" ? "seal-gift" : ""}`}>
                          <span className="seal-ring" style={{ rotate: `${i * 11}deg` }} />
                          <Icon size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-bold text-[var(--ink)]">{e.title}</span>
                          <span className="block text-[13px] text-[var(--ink-muted)]">{e.note}</span>
                        </span>
                        {e.soon && (
                          <span className="shrink-0 whitespace-nowrap rounded-full border border-[var(--edge)] px-2.5 py-0.5 text-[13px] font-bold text-[var(--ink-muted)]">
                            Coming soon
                          </span>
                        )}
                        <ChevronRight size={16} aria-hidden className="shrink-0 text-[var(--ink-dim)]" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="your-wallet" className="rounded-2xl bg-[var(--surface-2)] px-5 py-6">
        <h3 id="your-wallet" className="flex items-center gap-2 pb-2 text-[21px] font-bold text-[var(--ink)]">
          <ShieldCheck size={22} aria-hidden className="shrink-0 text-[var(--brand-text)]" /> How your wallet stays yours
        </h3>
        <p className="max-w-[60ch] pb-2 text-[15px] text-[var(--ink)]">Non-custodial: you approve every transaction in your own wallet.</p>
        <SafetyNote className="max-w-[60ch]" />
      </section>

      {GROUPS.filter((g) => g.id === "help").map((group) => (
        <nav key={group.id} aria-labelledby="help-and-rules">
          <h3 id="help-and-rules" className="pb-2 text-[21px] font-bold text-[var(--ink)]">{group.title}</h3>
          <ul className="grid grid-cols-2 gap-x-4 lg:grid-cols-3">
            {group.entries.map((e) => (
              <li key={e.id}>
                <Link href={e.href} className="flex min-h-[48px] items-center border-b border-[var(--border-subtle)] text-[15px] font-bold text-[var(--ink)] hover:text-[var(--brand-text)]">
                  {e.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </div>
  );
}
