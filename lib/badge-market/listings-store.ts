import { cacheGet, cacheSet } from "@/lib/redis-cache";

const LISTINGS_KEY = "badge-market:listings:v1";

export type BadgeListing = {
  id: string;
  seller: string;
  tokenId: number;
  catId: string;
  catName: string;
  tierName: string;
  tierIcon: string;
  priceUsdc: string;
  createdAt: number;
};

const memListings: BadgeListing[] = [];

export async function listBadgeListings(): Promise<BadgeListing[]> {
  const cached = await cacheGet<BadgeListing[]>(LISTINGS_KEY);
  const list = cached?.length ? cached : memListings;
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}

export async function addBadgeListing(
  listing: Omit<BadgeListing, "id" | "createdAt">
): Promise<BadgeListing> {
  const entry: BadgeListing = {
    ...listing,
    id: `bl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    seller: listing.seller.toLowerCase(),
    createdAt: Date.now(),
  };
  const all = await listBadgeListings();
  const next = [entry, ...all.filter((l) => !(l.seller === entry.seller && l.tokenId === entry.tokenId))];
  memListings.length = 0;
  memListings.push(...next);
  await cacheSet(LISTINGS_KEY, next, 60 * 60 * 24 * 90).catch(() => {});
  return entry;
}

export async function removeBadgeListing(id: string, seller: string): Promise<boolean> {
  const all = await listBadgeListings();
  const next = all.filter((l) => !(l.id === id && l.seller === seller.toLowerCase()));
  if (next.length === all.length) return false;
  memListings.length = 0;
  memListings.push(...next);
  await cacheSet(LISTINGS_KEY, next, 60 * 60 * 24 * 90).catch(() => {});
  return true;
}
