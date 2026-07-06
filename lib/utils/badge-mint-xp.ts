import { sumMintedBadges } from "@/lib/utils/achievements";

/** Season XP awarded per badge mint (counts toward season global ranking only). */
export const XP_PER_BADGE_MINT = 25;

function storageKey(address: string): string {
  return `base_season_badge_mints_${address.toLowerCase()}`;
}

export function readBadgeMintCount(address: string): number {
  if (typeof window === "undefined") return 0;
  const n = parseInt(localStorage.getItem(storageKey(address)) || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function writeBadgeMintCount(address: string, count: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(address), String(Math.max(0, count)));
  } catch {
    // quota / private mode
  }
}

/** Credit season XP for newly minted badges. Returns XP added this call. */
export function recordBadgeMints(address: string, count: number): number {
  if (!address || count <= 0) return 0;
  const prev = readBadgeMintCount(address);
  const next = prev + count;
  writeBadgeMintCount(address, next);
  return count * XP_PER_BADGE_MINT;
}

export function getBadgeMintXpTotal(address: string): number {
  return readBadgeMintCount(address) * XP_PER_BADGE_MINT;
}

function mintedLevelsKey(address: string): string {
  return `base_minted_levels_${address.toLowerCase()}`;
}

/** Never drop minted tiers when analyze returns empty (quick cache, RPC flake). */
export function mergeMintedLevelsMax(
  a: Record<string, number>,
  b: Record<string, number>
): Record<string, number> {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: Record<string, number> = {};
  for (const k of keys) {
    out[k] = Math.max(a[k] ?? 0, b[k] ?? 0);
  }
  return out;
}

export function readPersistedMintedLevels(
  address: string
): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(mintedLevelsKey(address));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export function writePersistedMintedLevels(
  address: string,
  levels: Record<string, number>
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(mintedLevelsKey(address), JSON.stringify(levels));
  } catch {
    // quota / private mode
  }
}

/** Backfill mint count from on-chain badge tiers (never decreases). */
export function syncBadgeMintCountFromLevels(
  address: string,
  mintedLevels: Record<string, number>
): void {
  const fromLevels = sumMintedBadges(mintedLevels);
  const prev = readBadgeMintCount(address);
  if (fromLevels > prev) {
    writeBadgeMintCount(address, fromLevels);
  }
}
