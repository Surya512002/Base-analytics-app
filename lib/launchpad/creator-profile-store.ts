import { cacheGet, cacheSet } from "@/lib/redis-cache";
import type { CreatorProfile } from "@/lib/launchpad/creator-profile-types";

export type { CreatorProfile } from "@/lib/launchpad/creator-profile-types";
export {
  creatorDisplayName,
  isCreatorProfileComplete,
} from "@/lib/launchpad/creator-profile-types";

const PROFILE_PREFIX = "launchpad:creator-profile:";
const PROFILE_INDEX_KEY = "launchpad:creator-profile-index:v1";
const PROFILE_TTL = 60 * 60 * 24 * 365;

const memProfiles = new Map<string, CreatorProfile>();

function key(address: string): string {
  return `${PROFILE_PREFIX}${address.trim().toLowerCase()}`;
}

function normalize(addr: string): string {
  return addr.trim().toLowerCase();
}

export async function getCreatorProfile(address: string): Promise<CreatorProfile | null> {
  const addr = normalize(address);
  const cached = await cacheGet<CreatorProfile>(key(addr));
  if (cached) return cached;
  return memProfiles.get(addr) ?? null;
}

export async function getCreatorProfiles(
  addresses: string[]
): Promise<Record<string, CreatorProfile>> {
  const unique = [...new Set(addresses.map(normalize).filter((a) => a.startsWith("0x")))];
  const out: Record<string, CreatorProfile> = {};
  await Promise.all(
    unique.map(async (addr) => {
      const p = await getCreatorProfile(addr);
      if (p) out[addr] = p;
    })
  );
  return out;
}

async function trackProfileIndex(address: string): Promise<void> {
  const addr = normalize(address);
  const index = (await cacheGet<string[]>(PROFILE_INDEX_KEY)) ?? [];
  if (!index.includes(addr)) {
    const next = [addr, ...index].slice(0, 2000);
    await cacheSet(PROFILE_INDEX_KEY, next, PROFILE_TTL).catch(() => {});
  }
}

export async function upsertCreatorProfile(
  address: string,
  patch: Partial<
    Pick<CreatorProfile, "displayName" | "bio" | "avatarUrl" | "website" | "twitter" | "telegram">
  >
): Promise<CreatorProfile> {
  const addr = normalize(address);
  const existing = (await getCreatorProfile(addr)) ?? {
    address: addr,
    createdAt: Date.now(),
    updatedAt: 0,
  };

  const next: CreatorProfile = {
    ...existing,
    displayName:
      patch.displayName !== undefined ? patch.displayName.trim() || undefined : existing.displayName,
    bio: patch.bio !== undefined ? patch.bio.trim() || undefined : existing.bio,
    avatarUrl:
      patch.avatarUrl !== undefined ? patch.avatarUrl.trim() || undefined : existing.avatarUrl,
    website:
      patch.website !== undefined ? patch.website.trim() || undefined : existing.website,
    twitter:
      patch.twitter !== undefined ? patch.twitter.trim() || undefined : existing.twitter,
    telegram:
      patch.telegram !== undefined ? patch.telegram.trim() || undefined : existing.telegram,
    address: addr,
    createdAt: existing.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  memProfiles.set(addr, next);
  await cacheSet(key(addr), next, PROFILE_TTL).catch(() => {});
  await trackProfileIndex(addr);
  return next;
}
