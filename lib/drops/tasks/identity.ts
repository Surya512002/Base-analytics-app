/**
 * Identity / reputation tasks: owns a Basename, wallet age and activity.
 */
import { parseAbi } from "viem";
import { z } from "zod";
import type { TaskType } from "../types";

/** Basenames registrar (ERC-721) on Base mainnet; checked onchain: name() = "Basenames". */
export const BASENAMES_REGISTRAR = "0x03c4738Ee98aE44591e1A4A4F3CaB6641d95DD9a" as const;
const BALANCE_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);

const basenameConfig = z.object({});

export const basenameTask: TaskType<z.infer<typeof basenameConfig>> = {
  type: "basename",
  label: "Own a Basename",
  trust: "onchain",
  needsSubmission: false,
  recheckAtClaim: true,
  configSchema: basenameConfig,
  async verify(_config, ctx) {
    if (ctx.chainId !== 8453) return { status: "unavailable", message: "Basename checks run on Base mainnet only." };
    try {
      const n = (await ctx.client.readContract({
        address: BASENAMES_REGISTRAR,
        abi: BALANCE_ABI,
        functionName: "balanceOf",
        args: [ctx.claimer],
      })) as bigint;
      return n > BigInt(0)
        ? { status: "passed", message: "Basename found." }
        : { status: "failed", message: "This wallet doesn't own a Basename (name.base.eth) yet." };
    } catch {
      return { status: "unavailable", message: "Couldn't check Basenames right now. Try again." };
    }
  },
};

// ───────────────────────────── wallet age / activity ─────────────────────────────

const ageConfig = z.object({
  minDays: z.number().int().min(1).max(3650).default(30),
  /** Minimum transactions sent or received (optional). */
  minTxs: z.number().int().min(1).max(10_000).optional(),
});

export const walletAgeTask: TaskType<z.infer<typeof ageConfig>> = {
  type: "wallet_age",
  label: "Wallet age and activity",
  trust: "verified",
  needsSubmission: false,
  recheckAtClaim: false,
  configSchema: ageConfig,
  async verify(config, ctx) {
    if (!ctx.env.explorerKey) return { status: "unavailable", message: "Wallet history checks aren't set up on this server yet." };
    const call = async (offset: number) => {
      const url = new URL("https://api.etherscan.io/v2/api");
      url.search = new URLSearchParams({
        chainid: String(ctx.chainId),
        module: "account",
        action: "txlist",
        address: ctx.claimer,
        page: "1",
        offset: String(offset),
        sort: "asc",
        apikey: ctx.env.explorerKey!,
      }).toString();
      const res = await ctx.fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = (await res.json()) as { message?: string; result?: unknown };
      if (Array.isArray(data.result)) return data.result as Array<{ timeStamp: string }>;
      if (String(data.message ?? "").toLowerCase().includes("no transactions")) return [];
      throw new Error("explorer");
    };
    try {
      const need = Math.max(1, config.minTxs ?? 1);
      const txs = await call(need);
      const first = txs[0];
      if (!first) return { status: "failed", message: "This wallet has no transactions on Base yet." };
      const ageDays = Math.floor((ctx.now - Number(first.timeStamp)) / 86_400);
      if (ageDays < config.minDays) {
        return { status: "failed", message: `This wallet is ${ageDays} days old; this drop needs ${config.minDays}.`, evidence: { ageDays } };
      }
      if (config.minTxs && txs.length < config.minTxs) {
        return { status: "failed", message: `This drop needs at least ${config.minTxs} transactions from this wallet.` };
      }
      return { status: "passed", message: `Wallet active for ${ageDays} days.`, evidence: { ageDays } };
    } catch {
      return { status: "unavailable", message: "Couldn't load wallet history right now. Try again." };
    }
  },
};
