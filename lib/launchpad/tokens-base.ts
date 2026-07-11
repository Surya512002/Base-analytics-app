/** Canonical Base mainnet assets used in swaps and seeding. */
export const USDC_BASE =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

export const USDC_DECIMALS = 6;

export type SwapAsset = "eth" | "usdc" | "token";

export function isValidTokenAddress(a: string | null | undefined): a is `0x${string}` {
  return Boolean(a && /^0x[a-fA-F0-9]{40}$/.test(a));
}
