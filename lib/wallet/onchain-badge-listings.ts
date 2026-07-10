import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { BADGE_MARKETPLACE_ABI } from "@/lib/constants/contracts";
import { BADGE_MARKETPLACE_CONTRACT } from "@/lib/constants/env";
import { allAchievementTokenIds } from "@/lib/wallet/owned-badges";

export type OnchainBadgeListing = {
  listingId: number;
  seller: string;
  tokenId: number;
  priceUsdc: string;
  catName: string;
  tierName: string;
  tierIcon: string;
};

export async function fetchOnchainBadgeListings(): Promise<OnchainBadgeListing[]> {
  if (!BADGE_MARKETPLACE_CONTRACT) return [];
  const client = createBasePublicClient();
  const catalog = allAchievementTokenIds();
  const byTokenId = new Map(catalog.map((c) => [c.tokenId, c]));

  try {
    const nextId = await client.readContract({
      address: BADGE_MARKETPLACE_CONTRACT as `0x${string}`,
      abi: BADGE_MARKETPLACE_ABI,
      functionName: "nextListingId",
    });
    const max = Number(nextId);
    const out: OnchainBadgeListing[] = [];

    for (let id = 1; id < max; id++) {
      const row = await client.readContract({
        address: BADGE_MARKETPLACE_CONTRACT as `0x${string}`,
        abi: BADGE_MARKETPLACE_ABI,
        functionName: "listings",
        args: [BigInt(id)],
      });
      const [seller, tokenId, price, active] = row as [string, bigint, bigint, boolean];
      if (!active) continue;
      const meta = byTokenId.get(Number(tokenId));
      out.push({
        listingId: id,
        seller: seller.toLowerCase(),
        tokenId: Number(tokenId),
        priceUsdc: (Number(price) / 1e6).toFixed(2),
        catName: meta?.catName ?? "Badge",
        tierName: meta?.tierName ?? `#${tokenId}`,
        tierIcon: meta?.tierIcon ?? "🏆",
      });
    }
    return out;
  } catch {
    return [];
  }
}
