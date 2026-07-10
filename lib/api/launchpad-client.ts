import type { LaunchedToken, TokenAnnouncement } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import type { LaunchDex } from "@/lib/launchpad/dex";
import type { AntiSnipeStatus } from "@/lib/launchpad/anti-snipe";

export type { LaunchDex };

export async function fetchDiscoverTokens(): Promise<{
  tokens: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
}> {
  const r = await fetch("/api/launchpad/discover", { cache: "no-store" });
  if (!r.ok) return { tokens: [], markets: {} };
  return r.json();
}

export async function resolveTokenByAddress(
  address: string
): Promise<{ token: LaunchedToken | null; market: TokenMarketSummary | null }> {
  const addr = address.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(addr)) {
    return { token: null, market: null };
  }
  const r = await fetch(`/api/launchpad/resolve/${addr}`, { cache: "no-store" });
  if (!r.ok) return { token: null, market: null };
  return r.json();
}

export async function fetchLaunchpadTokens(): Promise<{
  tokens: LaunchedToken[];
  b20Activated: boolean;
}> {
  const r = await fetch("/api/launchpad/tokens", { cache: "no-store" });
  if (!r.ok) return { tokens: [], b20Activated: false };
  return r.json();
}

/** Server-side activation check — reliable when client RPC is rate-limited. */
export async function fetchB20ActivationStatus(): Promise<boolean> {
  try {
    const r = await fetch("/api/launchpad/status", { cache: "no-store" });
    if (!r.ok) return false;
    const data = (await r.json()) as { activated?: boolean };
    return Boolean(data.activated);
  } catch {
    return false;
  }
}

export async function registerLaunchedToken(
  token: Omit<LaunchedToken, "createdAt"> & { createdAt?: number }
): Promise<boolean> {
  const r = await fetch("/api/launchpad/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(token),
  });
  return r.ok;
}

export async function uploadLaunchpadImage(file: Blob): Promise<string | null> {
  const form = new FormData();
  form.append("file", file, "token.webp");
  const r = await fetch("/api/launchpad/upload", { method: "POST", body: form });
  if (!r.ok) return null;
  const data = (await r.json()) as { url?: string };
  return data.url ?? null;
}

export type SwapQuoteResponse = {
  amountIn: string;
  amountOut: string;
  amountOutMinimum: string;
  hasLiquidity: boolean;
  tokenIn: string;
  tokenOut: string;
  dex?: "uniswap" | "aerodrome";
  router?: string;
  uniswapHasLiquidity?: boolean;
  aerodromeHasLiquidity?: boolean;
  uniswapFeeTier?: number;
  aerodromeStable?: boolean;
  platformFee?: string;
  grossAmount?: string;
  creator?: string;
  referrer?: string | null;
  feeShares?: { creator: string; platform: string; referrer: string };
  antiSnipe?: AntiSnipeStatus;
  error?: string;
};

export async function fetchSwapQuote(params: {
  token: string;
  direction: "buy" | "sell";
  amount: string;
  decimals: number;
  slippageBps: number;
  dex?: LaunchDex;
  referrer?: string | null;
}): Promise<SwapQuoteResponse> {
  const qs = new URLSearchParams({
    token: params.token,
    direction: params.direction,
    amount: params.amount,
    decimals: String(params.decimals),
    slippageBps: String(params.slippageBps),
    dex: params.dex ?? "auto",
  });
  if (params.referrer) qs.set("referrer", params.referrer);
  const r = await fetch(`/api/launchpad/quote?${qs}`, { cache: "no-store" });
  if (!r.ok) {
    return {
      amountIn: "0",
      amountOut: "0",
      amountOutMinimum: "0",
      hasLiquidity: false,
      tokenIn: "",
      tokenOut: "",
      error: "Quote failed",
    };
  }
  return r.json();
}

export async function fetchProtectionStatus(
  token: string,
  direction: "buy" | "sell" = "buy"
): Promise<AntiSnipeStatus & { launchBlock?: number | null; currentBlock?: number }> {
  const qs = new URLSearchParams({ token, direction });
  const r = await fetch(`/api/launchpad/protection?${qs}`, { cache: "no-store" });
  if (!r.ok) {
    return {
      active: false,
      blocksRemaining: 0,
      protectionUntilBlock: null,
      poolOpenBlock: null,
      antiSnipeBlocks: 8,
    };
  }
  return r.json();
}

export async function fetchAnnouncements(token: string): Promise<TokenAnnouncement[]> {
  const r = await fetch(`/api/launchpad/announcements?token=${token}`, { cache: "no-store" });
  if (!r.ok) return [];
  const data = (await r.json()) as { announcements?: TokenAnnouncement[] };
  return data.announcements ?? [];
}

export async function postAnnouncement(
  token: string,
  creator: string,
  body: string
): Promise<{ ok: boolean; error?: string; announcements?: TokenAnnouncement[] }> {
  const r = await fetch("/api/launchpad/announcements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, creator, body }),
  });
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error ?? "Failed to post" };
  }
  return r.json();
}
