/**
 * Trading tasks, checked from the wallet's token transfer history (Etherscan v2 API, Base).
 *
 * "Bought" = tokens received from a contract (a pool, router or aggregator) minus tokens sent
 * out, inside the window. Transfers from plain wallets don't count, so a friend sending you the
 * token isn't a "buy". Smart-wallet friends are contracts too, so this is a strong heuristic,
 * not a proof; drops that need certainty use the hold check at claim time as well.
 */
import { parseAbi } from "viem";
import { z } from "zod";
import type { TaskContext, TaskResult, TaskType } from "../types";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((a) => a as `0x${string}`);
const wei = z.string().regex(/^\d{1,78}$/);
const BALANCE_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);

const EXPLORER = "https://api.etherscan.io/v2/api";
/** Contracts checked per verification (getCode calls), to bound RPC use. */
const MAX_COUNTERPARTIES = 15;

interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
}

type TransfersResult = { ok: true; transfers: TokenTransfer[] } | { ok: false; result: TaskResult };

/** The wallet's transfers of `token` since `since` (unix seconds), oldest first. */
export async function fetchTokenTransfers(ctx: TaskContext, token: string, since: number): Promise<TransfersResult> {
  if (!ctx.env.explorerKey) {
    return { ok: false, result: { status: "unavailable", message: "Trade checks aren't set up on this server yet." } };
  }
  const url = new URL(EXPLORER);
  url.search = new URLSearchParams({
    chainid: String(ctx.chainId),
    module: "account",
    action: "tokentx",
    contractaddress: token,
    address: ctx.claimer,
    page: "1",
    offset: "1000",
    sort: "asc",
    apikey: ctx.env.explorerKey,
  }).toString();
  try {
    const res = await ctx.fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { status?: string; message?: string; result?: unknown };
    if (!Array.isArray(data.result)) {
      if (String(data.message ?? "").toLowerCase().includes("no transactions")) return { ok: true, transfers: [] };
      return { ok: false, result: { status: "unavailable", message: "Couldn't load your trades right now. Try again." } };
    }
    const transfers = (data.result as TokenTransfer[]).filter((t) => Number(t.timeStamp) >= since);
    return { ok: true, transfers };
  } catch {
    return { ok: false, result: { status: "unavailable", message: "Couldn't load your trades right now. Try again." } };
  }
}

async function isContract(ctx: TaskContext, addr: string, cache: Map<string, boolean>): Promise<boolean> {
  const k = addr.toLowerCase();
  if (cache.has(k)) return cache.get(k)!;
  const code = await ctx.client.getCode({ address: k as `0x${string}` }).catch(() => undefined);
  const yes = Boolean(code && code !== "0x");
  cache.set(k, yes);
  return yes;
}

/** Net amount bought (received from contracts − sent anywhere) in the transfers given. */
export async function netBought(ctx: TaskContext, transfers: TokenTransfer[]): Promise<{ net: bigint; buys: number }> {
  const me = ctx.claimer.toLowerCase();
  const cache = new Map<string, boolean>();
  let inflow = BigInt(0);
  let outflow = BigInt(0);
  let buys = 0;
  for (const t of transfers) {
    const from = t.from.toLowerCase();
    const to = t.to.toLowerCase();
    if (from === me && to === me) continue;
    if (from === me) {
      outflow += BigInt(t.value);
    } else if (to === me) {
      if (cache.size >= MAX_COUNTERPARTIES && !cache.has(from)) continue;
      if (await isContract(ctx, from, cache)) {
        inflow += BigInt(t.value);
        buys++;
      }
    }
  }
  return { net: inflow - outflow, buys };
}

// ───────────────────────────── buy a token ─────────────────────────────

const boughtConfig = z.object({
  token: address,
  minAmount: wei,
  /** Window start (unix seconds); default = when the drop was created. */
  since: z.number().int().positive().optional(),
  /** Also require holding at least minAmount when claiming (stops buy → claim → dump). */
  holdUntilClaim: z.boolean().default(true),
  symbol: z.string().max(16).optional(),
});

export const tokenBoughtTask: TaskType<z.infer<typeof boughtConfig>> = {
  type: "token_bought",
  label: "Buy a token",
  trust: "verified",
  needsSubmission: false,
  recheckAtClaim: true,
  configSchema: boughtConfig,
  async verify(config, ctx) {
    const since = config.since ?? ctx.dropCreatedAt;
    const loaded = await fetchTokenTransfers(ctx, config.token, since);
    if (!loaded.ok) return loaded.result;
    const { net, buys } = await netBought(ctx, loaded.transfers);
    const min = BigInt(config.minAmount);
    if (net < min) {
      return {
        status: "failed",
        message: `Buy ${config.symbol ?? "the token"} on a DEX (net, after any sells) to finish this.`,
        evidence: { netBought: net.toString(), buys },
      };
    }
    if (config.holdUntilClaim) {
      try {
        const bal = (await ctx.client.readContract({
          address: config.token,
          abi: BALANCE_ABI,
          functionName: "balanceOf",
          args: [ctx.claimer],
        })) as bigint;
        if (bal < min) return { status: "failed", message: "Keep holding what you bought until you claim." };
      } catch {
        return { status: "unavailable", message: "Couldn't read your balance right now. Try again." };
      }
    }
    return { status: "passed", message: "Buy confirmed.", evidence: { netBought: net.toString(), buys } };
  },
};

// ───────────────────────────── hold for N days ─────────────────────────────

const heldConfig = z.object({
  token: address,
  minAmount: wei,
  days: z.number().int().min(1).max(365),
  symbol: z.string().max(16).optional(),
});

export const heldSinceTask: TaskType<z.infer<typeof heldConfig>> = {
  type: "held_since",
  label: "Hold a token for a while",
  trust: "verified",
  needsSubmission: false,
  recheckAtClaim: true,
  configSchema: heldConfig,
  async verify(config, ctx) {
    const since = ctx.now - config.days * 86_400;
    const loaded = await fetchTokenTransfers(ctx, config.token, since);
    if (!loaded.ok) return loaded.result;
    const me = ctx.claimer.toLowerCase();
    let inflow = BigInt(0);
    let outflow = BigInt(0);
    for (const t of loaded.transfers) {
      if (t.from.toLowerCase() === me) outflow += BigInt(t.value);
      else if (t.to.toLowerCase() === me) inflow += BigInt(t.value);
    }
    let bal: bigint;
    try {
      bal = (await ctx.client.readContract({
        address: config.token,
        abi: BALANCE_ABI,
        functionName: "balanceOf",
        args: [ctx.claimer],
      })) as bigint;
    } catch {
      return { status: "unavailable", message: "Couldn't read your balance right now. Try again." };
    }
    const min = BigInt(config.minAmount);
    // Lowest balance during the window is at least (now − received) if nothing left the wallet.
    const heldThroughout = outflow === BigInt(0) && bal - inflow >= min;
    return heldThroughout
      ? { status: "passed", message: `Held for ${config.days} days.` }
      : {
          status: "failed",
          message: `Hold ${config.symbol ?? "the token"} for ${config.days} days without selling or sending it.`,
          evidence: { balance: bal.toString(), receivedInWindow: inflow.toString(), sentInWindow: outflow.toString() },
        };
  },
};
