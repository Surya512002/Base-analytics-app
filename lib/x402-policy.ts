/**
 * What our x402 facilitator is willing to verify / settle.
 *
 * The facilitator signs and pays gas for every settlement with a hot wallet. Without a policy,
 * anyone could POST any signed USDC authorization (e.g. between their own wallets, in a loop)
 * and make it pay the gas, draining it. So we only settle payments INTO the app treasury, in
 * USDC on Base, within sane bounds: each settlement then earns the treasury more than it costs.
 */
import { APP_TREASURY } from "@/lib/constants/treasury";

export const X402_NETWORK = "eip155:8453";
export const X402_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
/** $0.01 floor (covers gas on Base) and $1,000 ceiling, in USDC base units. */
export const X402_MIN_AMOUNT = BigInt(10_000);
export const X402_MAX_AMOUNT = BigInt(1_000_000_000);

type Req = {
  scheme?: unknown;
  network?: unknown;
  asset?: unknown;
  payTo?: unknown;
  amount?: unknown;
  maxAmountRequired?: unknown;
};

const same = (a: unknown, b: string) => typeof a === "string" && a.toLowerCase() === b.toLowerCase();

/** Returns why the requirements are refused, or null when they're ours. */
export function x402PolicyViolation(requirements: unknown): string | null {
  if (!requirements || typeof requirements !== "object") return "missing payment requirements";
  const r = requirements as Req;
  if (r.scheme !== "exact") return "unsupported scheme";
  if (!same(r.network, X402_NETWORK)) return "unsupported network";
  if (!same(r.asset, X402_USDC)) return "unsupported asset";
  if (!same(r.payTo, APP_TREASURY)) return "payee is not this app";
  const raw = r.amount ?? r.maxAmountRequired;
  let amount: bigint;
  try {
    amount = BigInt(String(raw));
  } catch {
    return "invalid amount";
  }
  if (amount < X402_MIN_AMOUNT || amount > X402_MAX_AMOUNT) return "amount out of bounds";
  return null;
}
