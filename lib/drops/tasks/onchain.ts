/**
 * Onchain tasks: read straight from Base at check time (and again right before a ticket).
 */
import { parseAbi, parseAbiItem, type AbiFunction } from "viem";
import { z } from "zod";
import type { TaskType } from "../types";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Must be a 0x address").transform((a) => a as `0x${string}`);
const wei = z.string().regex(/^\d{1,78}$/, "Whole base units");

const BALANCE_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);

// ───────────────────────────── hold a token ─────────────────────────────

const tokenBalanceConfig = z.object({
  token: address,
  minAmount: wei,
  symbol: z.string().max(16).optional(),
  decimals: z.number().int().min(0).max(36).optional(),
});

export const tokenBalanceTask: TaskType<z.infer<typeof tokenBalanceConfig>> = {
  type: "token_balance",
  label: "Hold a token",
  trust: "onchain",
  needsSubmission: false,
  recheckAtClaim: true,
  configSchema: tokenBalanceConfig,
  async verify(config, ctx) {
    try {
      const bal = (await ctx.client.readContract({
        address: config.token,
        abi: BALANCE_ABI,
        functionName: "balanceOf",
        args: [ctx.claimer],
      })) as bigint;
      const ok = bal >= BigInt(config.minAmount);
      return {
        status: ok ? "passed" : "failed",
        message: ok ? "You hold enough." : `You need to hold more ${config.symbol ?? "of this token"}.`,
        evidence: { balance: bal.toString() },
      };
    } catch {
      return { status: "unavailable", message: "Couldn't read your balance right now. Try again." };
    }
  },
};

// ───────────────────────────── any view function ─────────────────────────────

const contractReadConfig = z.object({
  contract: address,
  /** e.g. "function stakedOf(address) view returns (uint256)" — one address argument, uint or bool result. */
  signature: z.string().min(10).max(200),
  compare: z.enum([">=", ">", "==", "!="]),
  value: z.string().regex(/^(\d{1,78}|true|false)$/),
  description: z.string().max(120).optional(),
});

function parseReadFunction(signature: string): AbiFunction {
  const item = parseAbiItem(signature) as AbiFunction;
  if (item.type !== "function") throw new Error("Not a function");
  if (item.stateMutability !== "view" && item.stateMutability !== "pure") throw new Error("Must be a view function");
  if (item.inputs.length !== 1 || item.inputs[0]!.type !== "address") throw new Error("Must take one address");
  const out = item.outputs[0]?.type;
  if (item.outputs.length !== 1 || !(out === "bool" || /^uint\d*$/.test(out ?? ""))) {
    throw new Error("Must return one uint or bool");
  }
  return item;
}

export const contractReadTask: TaskType<z.infer<typeof contractReadConfig>> = {
  type: "contract_read",
  label: "Onchain condition",
  trust: "onchain",
  needsSubmission: false,
  recheckAtClaim: true,
  configSchema: contractReadConfig.superRefine((c, ctx) => {
    try {
      parseReadFunction(c.signature);
    } catch (e) {
      ctx.addIssue({ code: "custom", message: e instanceof Error ? e.message : "Bad signature" });
    }
  }),
  async verify(config, ctx) {
    const fn = parseReadFunction(config.signature);
    let raw: unknown;
    try {
      raw = await ctx.client.readContract({
        address: config.contract,
        abi: [fn],
        functionName: fn.name,
        args: [ctx.claimer],
      });
    } catch {
      return { status: "unavailable", message: "Couldn't read the contract right now. Try again." };
    }
    const actual = typeof raw === "boolean" ? (raw ? BigInt(1) : BigInt(0)) : BigInt(raw as bigint);
    const want =
      config.value === "true" ? BigInt(1) : config.value === "false" ? BigInt(0) : BigInt(config.value);
    const ok =
      config.compare === ">="
        ? actual >= want
        : config.compare === ">"
          ? actual > want
          : config.compare === "=="
            ? actual === want
            : actual !== want;
    return {
      status: ok ? "passed" : "failed",
      message: ok ? "Condition met." : config.description ? `Not yet: ${config.description}` : "Condition not met yet.",
      evidence: { value: actual.toString() },
    };
  },
};
