"use client";

import Link from "next/link";
import { CalendarClock, ListOrdered } from "lucide-react";
import { formatUnits } from "viem";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { useLimitOrders } from "@/src/lib/limitOrders/useLimitOrders";
import { nextRunText, summarizeAutomation } from "@/lib/plans/automation-summary";
import { AUTO_INVEST_HREF, LIMIT_ORDERS_HREF } from "@/lib/constants/destinations";

const row = "flex min-h-[64px] items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2.5 transition hover:border-[var(--brand)]";

/**
 * Auto-invest plans and open orders, shown with the stocks they act on. Until something is read from
 * the chain it only offers the two links, so a slow or failed read never claims "you have none".
 */
export default function AutomationStrip({ app }: { app: WalletAppState }) {
  const { plans, openOrders } = useLimitOrders(app);
  const s = summarizeAutomation(plans);
  const held = Number(formatUnits(s.heldForBuys, 6));

  return (
    <nav aria-label="Your automatic buys and orders" className="grid gap-2 sm:grid-cols-2">
      <Link href={AUTO_INVEST_HREF} className={row}>
        <CalendarClock size={18} aria-hidden className="shrink-0 text-[var(--brand-text)]" />
        <span className="min-w-0">
          <span className="block text-sm font-black text-[var(--ink)]">
            {s.running > 0 ? `${s.running} auto-invest plan${s.running === 1 ? "" : "s"} running` : "Auto-invest"}
          </span>
          <span className="block text-[11px] text-[var(--ink-muted)]">
            {s.running > 0 && s.nextRun !== null
              ? `${held > 0 ? `$${held.toLocaleString(undefined, { maximumFractionDigits: 2 })} still to be invested · ` : ""}next run ${nextRunText(s.nextRun, Math.floor(Date.now() / 1000))}`
              : "Buy stocks on a schedule"}
          </span>
        </span>
      </Link>
      <Link href={LIMIT_ORDERS_HREF} className={row}>
        <ListOrdered size={18} aria-hidden className="shrink-0 text-[var(--brand-text)]" />
        <span className="min-w-0">
          <span className="block text-sm font-black text-[var(--ink)]">
            {openOrders.length > 0 ? `${openOrders.length} open order${openOrders.length === 1 ? "" : "s"}` : "Limit and stop orders"}
          </span>
          <span className="block text-[11px] text-[var(--ink-muted)]">{openOrders.length > 0 ? "Check or cancel them" : "Buy lower, take profit or limit a loss"}</span>
        </span>
      </Link>
    </nav>
  );
}
