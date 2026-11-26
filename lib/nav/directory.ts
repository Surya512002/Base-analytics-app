/**
 * Every place in the app, listed once. The menu, the Home list, search and the footer all read
 * this file, so a thing has the same name everywhere.
 */
import { AUTO_INVEST_HREF, LIMIT_ORDERS_HREF, MY_ORDERS_HREF, MY_STOCKS_HREF, STOCK_LIST_HREF } from "@/lib/constants/destinations";
import { DROPS_CONTRACT } from "@/lib/drops/client";

export type PlaceId = "home" | "swap" | "trade" | "markets" | "earn" | "gifts" | "launch" | "account";

/** Where each menu item goes. Labels come from the translations (`t.nav[id]`). */
export const PLACE_HREF: Record<PlaceId, string> = {
  home: "/",
  swap: "/swap",
  trade: LIMIT_ORDERS_HREF,
  markets: STOCK_LIST_HREF,
  earn: "/lend",
  gifts: "/?tab=basehub",
  launch: "/launch",
  account: "/profile",
};

/** Computer menu and phone bottom bar. Gifts and Launch are reached from Home and search on phones;
 * phones also get a Profile button in the top bar. */
export const TOP_NAV: PlaceId[] = ["home", "swap", "trade", "markets", "earn", "gifts", "launch", "account"];
export const DOCK_NAV: PlaceId[] = ["home", "swap", "trade", "markets", "earn", "account"];

export type Entry = {
  id: string;
  title: string;
  note: string;
  href: string;
  /** Everyday words people might type in search, beyond the title and note. */
  words: string;
  soon?: boolean;
};

export type Group = { id: Exclude<PlaceId, "home" | "launch"> | "help"; title: string; entries: Entry[] };

export const GROUPS: Group[] = [
  {
    id: "swap",
    title: "Swap",
    entries: [
      { id: "swap", title: "Swap", note: "Exchange one token for another", href: "/swap", words: "exchange buy sell convert market order" },
    ],
  },
  {
    id: "trade",
    title: "Trade",
    entries: [
      { id: "orders", title: "Limit and stop", note: "Buy the dip or stop a loss", href: LIMIT_ORDERS_HREF, words: "limit order stop loss take profit trailing open orders cancel" },
      { id: "auto-invest", title: "Auto-invest", note: "Buy on a schedule", href: AUTO_INVEST_HREF, words: "recurring weekly dca schedule basket plan" },
      { id: "chart", title: "Chart", note: "Charts and order book", href: "/trade", words: "candles order book trades terminal" },
    ],
  },
  {
    id: "markets",
    title: "Markets",
    entries: [
      { id: "stocks", title: "Stocks", note: "Every tokenized stock, with live prices", href: STOCK_LIST_HREF, words: "shares equities nvda aapl tsla buy" },
      { id: "tokens", title: "All tokens", note: "Live tokens, market map and price alerts", href: "/explore", words: "coins explore prices alerts watchlist b20" },
    ],
  },
  {
    id: "earn",
    title: "Earn",
    entries: [
      { id: "lend", title: "Lend and borrow", note: "Borrow cash against your stocks", href: "/lend", words: "loan borrow interest usdc collateral morpho aave" },
      { id: "vaults", title: "Vaults and staking", note: "Put assets to work", href: "/lend?view=vaults", words: "yield stake staking aerodrome beefy apy" },
      { id: "compare", title: "Compare rates", note: "Rates side by side", href: "/lend?view=compare", words: "apy protocols yield scanner finder" },
    ],
  },
  {
    id: "gifts",
    title: "Gifts",
    entries: [
      { id: "send-gift", title: "Send a gift", note: "Share crypto with one link", href: "/?tab=basehub", words: "voucher gift card campaign send" },
      { id: "receive-gift", title: "Receive a gift", note: "Redeem a card sent to you", href: "/redeem", words: "redeem claim voucher gift card" },
      { id: "drops", title: "Drops", note: "Gifts with rules and tasks", href: "/drops", words: "airdrop tasks quest rewards", soon: !DROPS_CONTRACT },
    ],
  },
  {
    id: "account",
    title: "Profile",
    entries: [
      { id: "holdings", title: "Holdings", note: "Your stocks and rebalancing", href: MY_STOCKS_HREF, words: "my stocks portfolio balance rebalance" },
      { id: "my-orders", title: "Orders", note: "Open orders and auto-invest plans", href: MY_ORDERS_HREF, words: "my orders plans cancel history" },
      { id: "creator", title: "Creator earnings", note: "Your launches and what they earned", href: "/profile", words: "profile revenue fees vesting activity" },
      { id: "launch", title: "Launch a token", note: "Create one and earn on trades", href: "/launch", words: "create memecoin b20 launchpad" },
    ],
  },
  {
    id: "help",
    title: "Questions and rules",
    entries: [
      { id: "help", title: "Help", note: "How to buy, invest, earn, and what the risks are", href: "/help", words: "support how faq fees safety" },
      { id: "docs", title: "Documents and API", note: "Guides, contracts and developer tools", href: "/docs", words: "developer api mcp contracts compliance" },
      { id: "risks", title: "Risk disclosure", note: "What can go wrong", href: "/risk-disclosure", words: "risk disclosure loss" },
      { id: "terms", title: "Terms", note: "Terms of service", href: "/terms", words: "legal terms" },
      { id: "privacy", title: "Privacy", note: "What we keep about you", href: "/privacy", words: "legal privacy data" },
      { id: "regions", title: "Restricted regions", note: "Where some features are unavailable", href: "/restricted-regions", words: "country legal geography blocked" },
    ],
  },
];

export const ENTRIES: Entry[] = GROUPS.flatMap((g) => g.entries);

/** Found by search, but not listed on Home or in the footer. */
const SEARCH_ONLY: Entry[] = [
  { id: "settings", title: "Light or dark, language", note: "Change how the app looks", href: "/profile#settings", words: "theme dark mode light settings language" },
];

/** Every typed word must appear in the entry's name, note or everyday words. */
export function searchEntries(query: string): Entry[] {
  const typed = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return [...ENTRIES, ...SEARCH_ONLY].filter((e) => {
    const text = `${e.title} ${e.note} ${e.words}`.toLowerCase();
    return typed.every((w) => text.includes(w));
  });
}

/** Which menu item to highlight for a page address (and the open tab on "/"). */
export function placeFor(pathname: string, tab?: string | null): PlaceId {
  const under = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  if (under("/explore/token") || under("/swap")) return "swap";
  if (under("/trade")) return "trade";
  if (under("/explore")) return "markets";
  if (under("/lend")) return "earn";
  if (under("/drops") || under("/redeem") || under("/claim")) return "gifts";
  if (under("/launch")) return "launch";
  if (under("/profile") || under("/creator")) return "account";
  if (tab === "basehub" || tab === "drops") return "gifts";
  if (tab === "swap") return "swap";
  if (tab === "trade") return "trade";
  if (tab === "lend") return "earn";
  return "home";
}
