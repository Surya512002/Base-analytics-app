import { ACHIEVEMENTS_ABI, ACHIEVEMENTS_CONTRACT } from "@/lib/constants/contracts";
import { ACHIEVEMENTS } from "@/lib/constants/season";
import { getTargetTokenId } from "@/lib/utils/achievements";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

const MULTICALL_BATCH = 40;

type ChainReader = ReturnType<typeof createBasePublicClient>;

/** On-chain badge tiers per category — always fetch (fast RPC multicall). */
export async function fetchMintedLevelsFromChain(
  client: ChainReader,
  address: string
): Promise<Record<string, number>> {
  const calls: {
    address: `0x${string}`;
    abi: typeof ACHIEVEMENTS_ABI;
    functionName: "hasMinted";
    args: readonly [`0x${string}`, bigint];
  }[] = [];
  const callMap: { catId: string; level: number }[] = [];

  for (const cat of ACHIEVEMENTS) {
    for (let i = cat.thresholds.length; i >= 1; i--) {
      const tid = getTargetTokenId(cat.baseId, cat.thresholds.length, i);
      calls.push({
        address: ACHIEVEMENTS_CONTRACT as `0x${string}`,
        abi: ACHIEVEMENTS_ABI,
        functionName: "hasMinted",
        args: [address as `0x${string}`, BigInt(tid)],
      });
      callMap.push({ catId: cat.id, level: i });
    }
  }

  const ms: Record<string, number> = {};

  for (let i = 0; i < calls.length; i += MULTICALL_BATCH) {
    const slice = calls.slice(i, i + MULTICALL_BATCH);
    const sliceMap = callMap.slice(i, i + MULTICALL_BATCH);
    const batch = await client
      .multicall({ contracts: slice, allowFailure: true })
      .catch(() => []);

    if (!Array.isArray(batch)) continue;

    batch.forEach((r, idx) => {
      const { catId, level } = sliceMap[idx]!;
      if (r.status === "success" && r.result === true) {
        if (!ms[catId] || ms[catId] < level) ms[catId] = level;
      }
    });
  }

  return ms;
}
