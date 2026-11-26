"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  CandlestickChart,
  CircleDollarSign,
  Compass,
  FileText,
  Gift,
  Globe,
  Landmark,
  LifeBuoy,
  Lock,
  PackageOpen,
  PieChart,
  ReceiptText,
  Rocket,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  TriangleAlert,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";
import TokenLogo from "@/components/ui/TokenLogo";
import SafetyNote from "@/components/ui/SafetyNote";
import { useStockMarkets } from "@/hooks/useMarketsData";
import { STOCK_LIST_HREF } from "@/lib/constants/destinations";
import { mostTraded } from "@/lib/markets/most-traded";
import { ENTRIES, GROUPS } from "@/lib/nav/directory";

/** Names, notes and addresses come from the directory, so a thing is called the same everywhere. */
const entry = (id: string) => ENTRIES.find((e) => e.id === id)!;

const ICONS: Record<string, LucideIcon> = {
  swap: ArrowLeftRight,
  orders: Target,
  "auto-invest": CalendarClock,
  chart: CandlestickChart,
  tokens: Compass,
  lend: Landmark,
  "send-gift": Gift,
  "receive-gift": PackageOpen,
  drops: Sparkles,
  holdings: PieChart,
  "my-orders": ReceiptText,
  creator: CircleDollarSign,
  launch: Rocket,
  help: LifeBuoy,
  docs: FileText,
  risks: TriangleAlert,
  terms: ScrollText,
  privacy: Lock,
  regions: Globe,
};

const YOURS = ["holdings", "my-orders", "creator", "chart", "drops"];

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const frame = "rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)]";
const lift = "transition duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] active:scale-[0.98]";
const well = "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl";
const swipe = "flex snap-x snap-mandatory gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function Tile({ id, className = "" }: { id: string; className?: string }) {
  const e = entry(id);
  const Icon = ICONS[id]!;
  return (
    <Link href={e.href} className={`${frame} ${lift} flex min-h-[136px] flex-col p-4 ${className}`}>
      <span aria-hidden className={`${well} bg-[var(--brand-soft)] text-[var(--brand-text)]`}>
        <Icon size={22} />
      </span>
      <span className="font-display mt-auto pt-3 text-[17px] font-bold leading-tight text-[var(--ink)]">{e.title}</span>
      <span className="text-[13px] text-[var(--ink-muted)]">{e.note}</span>
    </Link>
  );
}

/** Home: today's busiest stocks, then every part of the app as one grid of tiles. */
export default function SimpleStart() {
  const { stocks, loading } = useStockMarkets();
  const popular = mostTraded(stocks, 6);
  const auto = entry("auto-invest");
  const lend = entry("lend");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <section aria-labelledby="popular-today">
        <div className="flex items-center justify-between gap-3">
          <h2 id="popular-today" className="text-[17px] font-bold text-[var(--ink)]">Popular today</h2>
          <Link href={STOCK_LIST_HREF} className="flex min-h-[44px] items-center text-[13px] font-bold text-[var(--brand-text)]">
            See all stocks
          </Link>
        </div>
        {popular.length === 0 ? (
          <p role="status" className={`${frame} px-4 py-3 text-[13px] text-[var(--ink-muted)]`}>
            {loading ? "Loading prices…" : "Prices are not available right now."}
          </p>
        ) : (
          <ul className={`${swipe} pb-1`}>
            {popular.map((s) => (
              <li key={s.address} className="shrink-0 snap-start">
                <Link href={`/trade?token=${s.address}`} className={`${frame} flex min-h-[56px] items-center gap-2.5 py-2 pl-2 pr-4 hover:border-[var(--brand)]`}>
                  <TokenLogo address={s.address} symbol={s.symbol} size={36} />
                  <span className="whitespace-nowrap tabular-nums">
                    <span className="block text-[15px] font-bold text-[var(--ink)]">{s.symbol}</span>
                    <span className="block text-[13px] text-[var(--ink-muted)]">
                      {usd(s.price)}
                      {/* The feed sends 0 when it has no change figure, so 0 is not shown. */}
                      {s.change24h !== 0 && (
                        <span className={`ml-1.5 font-bold ${s.change24h > 0 ? "text-[var(--success-text)]" : "text-[var(--danger-text)]"}`}>
                          {s.change24h > 0 ? "+" : ""}
                          {s.change24h.toFixed(2)}%
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav aria-label="Start here" className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Link
          href={STOCK_LIST_HREF}
          className="col-span-2 flex min-h-[250px] flex-col rounded-3xl border border-[#2f7bff] bg-[linear-gradient(140deg,#0a63ff,#0035b3_75%)] p-5 text-white shadow-[0_20px_44px_rgba(0,70,220,0.32)] transition duration-200 hover:-translate-y-0.5 active:scale-[0.99] lg:col-span-3 lg:row-span-2"
        >
          <span aria-hidden className={`${well} bg-white/20`}>
            <TrendingUp size={24} />
          </span>
          <span className="font-display mt-auto pt-6 text-[30px] font-bold leading-tight">Buy a stock</span>
          <span className="text-[15px] text-[#e3ecff]">Tokenized US stocks, paid with USDC or ETH</span>
          <span aria-hidden className="mt-4 flex min-h-10">
            {popular.slice(0, 5).map((s) => (
              <span key={s.address} className="-mr-2.5 rounded-full border-2 border-white bg-white">
                <TokenLogo address={s.address} symbol={s.symbol} size={36} />
              </span>
            ))}
          </span>
          <span className="mt-4 inline-flex min-h-10 items-center gap-1.5 self-start rounded-full bg-white px-4 text-sm font-bold text-[#0035b3]">
            Browse stocks <ArrowUpRight size={17} aria-hidden />
          </span>
        </Link>

        <Tile id="swap" />
        <Tile id="orders" className="lg:col-span-2" />

        <Link
          href={auto.href}
          className="col-span-2 flex flex-col rounded-3xl border border-[#2b3b80] bg-[linear-gradient(140deg,#101a3c,#1b2a63)] p-4 text-white transition duration-200 hover:-translate-y-0.5 active:scale-[0.99] lg:col-span-3 lg:col-start-4"
        >
          <span aria-hidden className={`${well} bg-white/15`}>
            <CalendarClock size={22} />
          </span>
          <span className="font-display mt-auto pt-3 text-[17px] font-bold">{auto.title}</span>
          <span className="text-[13px] text-[#d3dcff]">A little every week. Cancel any time.</span>
          <span aria-hidden className="mt-3 flex gap-1.5">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
              <span key={i} className={`max-w-11 flex-1 rounded-[10px] py-1.5 text-center text-[13px] font-bold ${i === 0 ? "bg-white text-[#0a2a8a]" : "bg-white/10"}`}>
                {day}
              </span>
            ))}
          </span>
        </Link>

        {/* The whole tile opens lending; the two chips sit above that link. */}
        <div className={`${frame} ${lift} relative col-span-2 flex flex-col p-4`}>
          <span aria-hidden className={`${well} bg-[var(--brand-soft)] text-[var(--brand-text)]`}>
            <Landmark size={22} />
          </span>
          <Link href={lend.href} className="font-display mt-auto pt-3 text-[17px] font-bold text-[var(--ink)] after:absolute after:inset-0 after:rounded-3xl">
            {lend.title}
          </Link>
          <span className="text-[13px] text-[var(--ink-muted)]">{lend.note}</span>
          <span className="mt-3 flex flex-wrap gap-2">
            {["vaults", "compare"].map((id) => (
              <Link key={id} href={entry(id).href} className="relative z-10 flex min-h-9 items-center rounded-full bg-[var(--brand-soft)] px-3 text-[13px] font-bold text-[var(--brand-text)] hover:underline">
                {entry(id).title}
              </Link>
            ))}
          </span>
        </div>

        <Tile id="send-gift" />
        <Tile id="receive-gift" />
        <Tile id="launch" />
        <Tile id="tokens" />
      </nav>

      <section aria-labelledby="your-space">
        <h2 id="your-space" className="pb-3 text-[21px] font-bold text-[var(--ink)]">Your space</h2>
        <ul className={`${swipe} pb-1 lg:grid lg:grid-cols-5`}>
          {YOURS.map((id) => {
            const e = entry(id);
            const Icon = ICONS[id]!;
            return (
              <li key={id} className="w-[230px] shrink-0 snap-start lg:w-auto">
                <Link href={e.href} className={`${frame} ${lift} flex h-full min-h-[72px] items-center gap-3 p-3`}>
                  <span aria-hidden className={`${well} bg-[var(--brand-soft)] text-[var(--brand-text)]`}>
                    <Icon size={22} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold text-[var(--ink)]">{e.title}</span>
                    <span className="block text-[13px] text-[var(--ink-muted)]">{e.soon ? "Coming soon" : e.note}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="your-wallet" className={`${frame} px-5 py-5`}>
        <h2 id="your-wallet" className="flex items-center gap-2 pb-2 text-[17px] font-bold text-[var(--ink)]">
          <ShieldCheck size={20} aria-hidden className="shrink-0 text-[var(--brand-text)]" /> How your wallet stays yours
        </h2>
        <p className="max-w-[70ch] pb-2 text-[15px] text-[var(--ink)]">Non-custodial: you approve every transaction in your own wallet.</p>
        <SafetyNote className="max-w-[70ch]" />
      </section>

      {GROUPS.filter((g) => g.id === "help").map((group) => (
        <nav key={group.id} aria-label={group.title}>
          <ul className="flex flex-wrap gap-2">
            {group.entries.map((e) => {
              const Icon = ICONS[e.id] ?? FileText;
              return (
                <li key={e.id}>
                  <Link href={e.href} className={`${frame} flex min-h-11 items-center gap-2 px-4 text-sm font-bold text-[var(--ink)] hover:border-[var(--brand)]`}>
                    <Icon size={16} aria-hidden /> {e.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ))}
    </div>
  );
}
