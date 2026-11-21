/**
 * Checks on a fee event the browser reports after a swap. The ledger feeds the "creator revenue"
 * numbers on public profiles, so a client must not be able to credit any creator any amount.
 * Pure functions, so the rules are easy to test.
 */

/** Largest fee one event may claim, in base units. "token" fees have unknown decimals, so no cap. */
export const MAX_FEE_BASE_UNITS: Record<"eth" | "usdc", bigint> = {
  eth: BigInt("2000000000000000000"), // 2 ETH of fee, about a $700k trade at 0.5%
  usdc: BigInt(50_000_000_000), // 50,000 USDC of fee, about a $10M trade
};

export function feeAmountError(asset: "eth" | "usdc" | "token", amount: bigint): string | null {
  if (amount <= BigInt(0)) return "Fee must be above zero";
  if (asset !== "token" && amount > MAX_FEE_BASE_UNITS[asset]) return "Fee amount is above the allowed maximum";
  return null;
}

/** The registry entry must exist and name the same creator the browser sent. */
export function tokenCreatorError(registry: Array<{ address: string; creator: string }>, token: string, creator: string): string | null {
  const known = registry.find((t) => t.address.toLowerCase() === token);
  if (!known) return "Unknown launched token";
  if (known.creator.toLowerCase() !== creator) return "Creator doesn't match this token";
  return null;
}

const padAddress = (a: string) => `0x${a.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;

/**
 * A mined transaction counts for this trader when it succeeded and either they sent it or one of its
 * logs names them (smart wallets send through a bundler, so `from` isn't the trader). Returns an
 * error message, or null when it checks out.
 */
export function receiptError(
  receipt: { status: string; from: string; logs: Array<{ address: string; topics: readonly string[] }> },
  trader: string,
  token: string
): string | null {
  if (receipt.status !== "success") return "That transaction failed";
  if (receipt.from.toLowerCase() === trader) return null;
  const topic = padAddress(trader);
  const involved = receipt.logs.some((l) => l.address.toLowerCase() === token || l.topics.some((t) => t.toLowerCase() === topic));
  return involved ? null : "That transaction doesn't involve this trader";
}
