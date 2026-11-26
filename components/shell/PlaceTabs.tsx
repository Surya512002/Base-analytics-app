"use client";

import Link from "next/link";
import { CandlestickChart } from "lucide-react";
import { AUTO_INVEST_HREF, LIMIT_ORDERS_HREF, MY_STOCKS_HREF } from "@/lib/constants/destinations";

type Item = { id: string; label: string; href: string; badge?: number };

/** The switches at the top of a place. Each one is a real link, so back and sharing work. */
export default function PlaceTabs({
  label,
  items,
  current,
  onSelect,
}: {
  label: string;
  items: Item[];
  current: string;
  /** For a switch whose page is already open: the address may not change, so set the view too. */
  onSelect?: (id: string) => void;
}) {
  return (
    <nav aria-label={label} className="place-tabs">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          scroll={false}
          aria-current={current === item.id ? "page" : undefined}
          onClick={() => onSelect?.(item.id)}
        >
          {item.label}
          {Boolean(item.badge) && <span className="place-tabs-badge">{item.badge}</span>}
        </Link>
      ))}
    </nav>
  );
}

export type TradeView = "swap" | "orders" | "auto-invest" | "chart";

export function TradeTabs({
  current,
  openOrders,
  plans,
  onSelect,
}: {
  current: TradeView;
  openOrders?: number;
  plans?: number;
  onSelect?: (id: TradeView) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[640px] items-center gap-2">
      <div className="min-w-0 flex-1">
        <PlaceTabs
          label="Trade"
          current={current}
          onSelect={(id) => onSelect?.(id as TradeView)}
          items={[
            { id: "swap", label: "Swap", href: "/swap" },
            { id: "orders", label: "Limit and stop", href: LIMIT_ORDERS_HREF, badge: openOrders },
            { id: "auto-invest", label: "Auto-invest", href: AUTO_INVEST_HREF, badge: plans },
          ]}
        />
      </div>
      <Link
        href="/trade"
        scroll={false}
        aria-current={current === "chart" ? "page" : undefined}
        onClick={() => onSelect?.("chart")}
        className="place-tabs-extra"
      >
        <CandlestickChart size={18} aria-hidden /> <span className="max-sm:sr-only">Chart</span>
      </Link>
    </div>
  );
}

export function AccountTabs({ current, creatorHref = "/profile" }: { current: "holdings" | "creator"; creatorHref?: string }) {
  return (
    <div className="mx-auto w-full max-w-[480px]">
      <PlaceTabs
        label="Account"
        current={current}
        items={[
          { id: "holdings", label: "Holdings", href: MY_STOCKS_HREF },
          { id: "creator", label: "Creator", href: creatorHref },
        ]}
      />
    </div>
  );
}
