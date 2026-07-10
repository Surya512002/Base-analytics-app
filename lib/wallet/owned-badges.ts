import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { ACHIEVEMENTS_ABI, ACHIEVEMENTS_CONTRACT } from "@/lib/constants/contracts";
import { ACHIEVEMENTS } from "@/lib/constants/season";
import { getTargetTokenId } from "@/lib/utils/achievements";

export type OwnedBadge = {
  tokenId: number;
  catId: string;
  catName: string;
  tierName: string;
  tierIcon: string;
  balance: number;
};

export function allAchievementTokenIds(): Array<{
  tokenId: number;
  catId: string;
  catName: string;
  tierName: string;
  tierIcon: string;
}> {
  const out: Array<{
    tokenId: number;
    catId: string;
    catName: string;
    tierName: string;
    tierIcon: string;
  }> = [];
  for (const cat of ACHIEVEMENTS) {
    const n = cat.thresholds.length;
    for (let level = 1; level <= n; level++) {
      out.push({
        tokenId: getTargetTokenId(cat.baseId, n, level),
        catId: cat.id,
        catName: cat.name,
        tierName: cat.tierNames[level - 1] ?? `Tier ${level}`,
        tierIcon: cat.tierIcons[level - 1] ?? cat.icon,
      });
    }
  }
  return out;
}

export function openSeaBadgeUrl(tokenId: number): string {
  return `https://opensea.io/assets/base/${ACHIEVEMENTS_CONTRACT}/${tokenId}`;
}

export async function fetchOwnedBadges(address: string): Promise<OwnedBadge[]> {
  const client = createBasePublicClient();
  const catalog = allAchievementTokenIds();
  const owned: OwnedBadge[] = [];

  await Promise.all(
    catalog.map(async (item) => {
      try {
        const bal = await client.readContract({
          address: ACHIEVEMENTS_CONTRACT as `0x${string}`,
          abi: ACHIEVEMENTS_ABI,
          functionName: "balanceOf",
          args: [address as `0x${string}`, BigInt(item.tokenId)],
        });
        const n = Number(bal);
        if (n > 0) {
          owned.push({ ...item, balance: n });
        }
      } catch {
        /* skip */
      }
    })
  );

  return owned.sort((a, b) => a.tokenId - b.tokenId);
}
