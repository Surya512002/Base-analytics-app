import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import AppFooterNav from "@/components/wallet/AppFooterNav";
import { AUTO_INVEST_HREF, LIMIT_ORDERS_HREF, MY_STOCKS_HREF } from "@/lib/constants/destinations";

export const metadata: Metadata = {
  title: "Help | Base Analytics",
  description: "How to buy tokenized stocks, invest automatically, place limit orders, borrow, and what the risks and fees are.",
};

const TASKS: ReadonlyArray<{ title: string; href: string; link: string; steps: string[] }> = [
  {
    title: "Buy a stock",
    href: "/trade",
    link: "Open Trade",
    steps: ["Connect your wallet and use the Base network.", "Pick a stock, enter an amount and check what you will receive.", "Confirm in your wallet. If the price moves more than your slippage, the swap is not made."],
  },
  {
    title: "Invest automatically",
    href: AUTO_INVEST_HREF,
    link: "Set up a plan",
    steps: ["Pick your stocks, a budget and how often to buy, or start from a ready-made plan.", "The USDC for the plan is held by the order contract until each buy runs.", "Cancel any time and the unused USDC comes back. Buys wait while the stock price feed is paused, for example at weekends."],
  },
  {
    title: "Buy the dip, take profit or limit a loss",
    href: LIMIT_ORDERS_HREF,
    link: "Place an order",
    steps: ["Choose a price and the order does the rest when the market reaches it.", "Orders use the Chainlink stock price, which can differ a little from the chart.", "An order is not guaranteed: if the market jumps or there is little liquidity, it may not fill."],
  },
  {
    title: "See and rebalance your stocks",
    href: MY_STOCKS_HREF,
    link: "Open My Stocks",
    steps: ["See each stock's value and share of your portfolio.", "Set the mix you want and follow the suggested trades."],
  },
  {
    title: "Borrow or earn",
    href: "/lend",
    link: "Open Lend & Stake",
    steps: ["You can borrow USDC against stocks. If their price falls too far, your stocks can be sold to repay the loan (liquidation).", "Pool vaults can show very high rates. They are often small and can lose value, so read the details first."],
  },
];

export default function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--ink)]">
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--brand)]">
          <ArrowLeft size={13} /> Home
        </Link>
        <h1 className="font-display text-3xl font-black tracking-tight">Help</h1>

        {TASKS.map((t) => (
          <section key={t.title} className="space-y-3 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <h2 className="text-lg font-black">{t.title}</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-[var(--ink-muted)]">
              {t.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <Link href={t.href} className="inline-flex min-h-[40px] items-center rounded-xl bg-[var(--brand)] px-4 text-sm font-bold text-white">
              {t.link}
            </Link>
          </section>
        ))}

        <section className="space-y-2 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 text-sm text-[var(--ink-muted)]">
          <h2 className="text-lg font-black text-[var(--ink)]">Fees</h2>
          <p>Swaps carry a trading fee shown on the swap screen, plus the pool&apos;s own fee, price impact and network gas.</p>
          <p>Orders and automatic buys carry a small execution fee, shown on the form, charged only when something runs.</p>
        </section>

        <section className="space-y-2 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <ShieldAlert size={18} /> Stay safe
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Never share your recovery phrase or private key. This app never asks for it.</li>
            <li>Check the address bar and read each wallet request before you confirm it.</li>
            <li>Prices can fall, and smart contracts can have faults. Only put in what you can afford to lose.</li>
            <li>Tokenized stocks are only for eligible people outside the United States.</li>
          </ul>
          <p className="pt-1">
            <Link href="/risk-disclosure" className="font-bold underline">
              Risks
            </Link>{" "}
            ·{" "}
            <Link href="/terms" className="font-bold underline">
              Terms
            </Link>{" "}
            ·{" "}
            <Link href="/privacy" className="font-bold underline">
              Privacy
            </Link>{" "}
            ·{" "}
            <Link href="/docs" className="font-bold underline">
              Developer documents
            </Link>
          </p>
        </section>
      </main>
      <AppFooterNav />
    </div>
  );
}
