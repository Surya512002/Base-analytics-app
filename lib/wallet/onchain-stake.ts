import { createBasePublicClient, withRpcRetry } from "@/lib/utils/base-rpc";
import { XP_STAKE_CONTRACT } from "@/lib/constants/env";
import { XP_STAKE_ABI } from "@/lib/constants/contracts";

export type OnchainStake = {
  amount: bigint;
  unlockAt: number;
  tier: number;
  active: boolean;
};

export function tierToReferrerBoostBps(tier: number): number {
  if (tier >= 3) return 1000;
  if (tier >= 2) return 500;
  if (tier >= 1) return 200;
  return 0;
}

export function tierToMultiplier(tier: number): number {
  if (tier >= 3) return 1.5;
  if (tier >= 2) return 1.25;
  if (tier >= 1) return 1.1;
  return 1;
}

export async function fetchOnchainStake(address: string): Promise<OnchainStake | null> {
  if (!XP_STAKE_CONTRACT) return null;
  try {
    const client = createBasePublicClient();
    const result = await withRpcRetry(() =>
      client.readContract({
        address: XP_STAKE_CONTRACT as `0x${string}`,
        abi: XP_STAKE_ABI,
        functionName: "getStake",
        args: [address as `0x${string}`],
      })
    );
    const [amount, unlockAt, tier, active] = result as [bigint, bigint, number, boolean];
    if (!active || amount === BigInt(0)) return null;
    return {
      amount,
      unlockAt: Number(unlockAt) * 1000,
      tier: Number(tier),
      active,
    };
  } catch {
    return null;
  }
}
