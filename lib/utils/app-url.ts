import type { AppTab } from "@/hooks/useWalletApp";

const TAB_ALIASES: Record<string, AppTab> = {
  launchpad: "launchpad",
  launch: "launchpad",
  terminal: "launchpad",
  explore: "launchpad",
  markets: "launchpad",
  swap: "swap",
  trade: "swap",
  dex: "swap",
  predictions: "launchpad",
  predict: "launchpad",
  dashboard: "launchpad",
  analytics: "launchpad",
  checkin: "launchpad",
  "check-in": "launchpad",
  actions: "launchpad",
  habits: "launchpad",
  streaks: "launchpad",
  quests: "launchpad",
  rankings: "launchpad",
  leaderboard: "launchpad",
  voucher: "basehub",
  vouchers: "basehub",
  basehub: "basehub",
  badges: "launchpad",
  achievements: "launchpad",
  rewards: "lend",
  stake: "lend",
  staking: "lend",
  lend: "lend",
  lending: "lend",
  borrow: "lend",
  borrowing: "lend",
  earn: "lend",
  vaults: "lend",
};

export function buildLendPath(): string {
  return "/lend";
}

export function buildLaunchPath(): string {
  return "/launch";
}

export function resolveTabFromUrl(search?: string): AppTab | null {
  if (typeof window === "undefined" && !search) return null;
  const raw = search ?? (typeof window !== "undefined" ? window.location.search : "");
  const searchParams = new URLSearchParams(raw);
  const t = searchParams.get("tab");
  if (t && TAB_ALIASES[t]) return TAB_ALIASES[t];

  // Infer basehub if voucher claim parameters are present
  if (
    searchParams.has("card") ||
    searchParams.has("cardId") ||
    searchParams.has("voucher") ||
    searchParams.has("c")
  ) {
    return "basehub";
  }

  if (typeof window !== "undefined" && window.location.hash) {
    const hash = window.location.hash.replace(/^#/, "");
    const hashParams = new URLSearchParams(hash);
    if (hashParams.has("id") || hashParams.has("card")) {
      return "basehub";
    }
  }

  return null;
}

export {
  buildSwapLink,
  parseSwapUrlParams,
  normalizeTokenAddress,
  type SwapLinkParams,
  type ParsedSwapParams,
} from "@/lib/swap/swap-link";
import { buildSwapLink, parseSwapUrlParams } from "@/lib/swap/swap-link";

export function resolveTokenFromUrl(search?: string): string | null {
  if (typeof window === "undefined" && !search) return null;
  const raw = search ?? window.location.search;
  const parsed = parseSwapUrlParams(raw);
  return parsed.buy;
}

export function syncTabUrl(tab: AppTab, opts?: { token?: string | null; buy?: string | null; sell?: string | null; amount?: string | number | null }) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  const buyAddr = opts?.buy ?? opts?.token;
  if (buyAddr) {
    url.searchParams.set("buy", buyAddr);
    url.searchParams.delete("token");
  } else {
    url.searchParams.delete("buy");
    url.searchParams.delete("token");
  }
  if (opts?.sell) {
    url.searchParams.set("sell", opts.sell);
  } else {
    url.searchParams.delete("sell");
  }
  if (opts?.amount) {
    url.searchParams.set("amount", String(opts.amount));
  } else {
    url.searchParams.delete("amount");
  }
  window.history.replaceState({}, "", url);
}

export function buildSwapTokenPath(address: string): string {
  return buildSwapLink({ buy: address });
}

export function buildSwapPath(opts?: { buy?: string | null; sell?: string | null; amount?: string | number | null }): string {
  if (opts?.buy || opts?.sell || opts?.amount) {
    return buildSwapLink(opts);
  }
  return "/swap";
}

export function buildExploreTokenPath(address: string): string {
  return `/explore/token/${address}`;
}

export function buildExplorePath(): string {
  return "/explore";
}

export function buildRedeemDeepLink(cardId: string, secret?: string): string {
  const qs = new URLSearchParams({ tab: "basehub" });
  qs.set("card", cardId);
  if (secret) qs.set("secret", secret);
  return `/?${qs.toString()}`;
}

export function buildGiftVoucherDeepLink(amountUsdc = "5"): string {
  return `/?tab=basehub&create=1&asset=USDC&total=${amountUsdc}&cards=1`;
}

