import type { AnalyzeWalletResult } from "@/lib/types/wallet";

/** Bump to reset stale per-wallet session keys after storage logic changes. */
export const SESSION_STORAGE_VERSION = 5;

export const DEFAULT_TX_KEYS: Record<string, number> = {
  boost: 0,
  gm: 0,
  gn: 0,
  checkin: 0,
  redeem: 0,
};

function addrKey(address: string): string {
  return address.toLowerCase();
}

function txKeysKey(address: string): string {
  return `base_txkeys_${addrKey(address)}`;
}

function checkInCountKey(address: string): string {
  return `base_checkin_count_${addrKey(address)}`;
}

function boostsKey(address: string): string {
  return `base_boosts_${addrKey(address)}`;
}

function referralBonusKey(address: string): string {
  return `base_referral_bonus_xp_${addrKey(address)}`;
}

/** One-time cleanup of inflated session keys after deploys / logic changes. */
export function ensureSessionStorageVersion(): void {
  if (typeof window === "undefined") return;
  const key = "base_session_v";
  if (localStorage.getItem(key) === String(SESSION_STORAGE_VERSION)) return;

  const prefixes = [
    "base_boosts_",
    "base_checkin_count_",
    "base_txkeys_",
  ];
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && prefixes.some((p) => k.startsWith(p))) {
      localStorage.removeItem(k);
    }
  }
  localStorage.setItem(key, String(SESSION_STORAGE_VERSION));
}

export function readPersistedTxKeys(address: string): Record<string, number> {
  if (typeof window === "undefined") return { ...DEFAULT_TX_KEYS };
  try {
    const raw = localStorage.getItem(txKeysKey(address));
    if (!raw) return { ...DEFAULT_TX_KEYS };
    const parsed = JSON.parse(raw) as Record<string, number>;
    return { ...DEFAULT_TX_KEYS, ...parsed };
  } catch {
    return { ...DEFAULT_TX_KEYS };
  }
}

export function writePersistedTxKeys(
  address: string,
  keys: Record<string, number>
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(txKeysKey(address), JSON.stringify(keys));
  } catch {
    // quota / private mode
  }
}

export function readLocalCheckInCount(address: string): number {
  if (typeof window === "undefined") return 0;
  const n = parseInt(localStorage.getItem(checkInCountKey(address)) || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function writeLocalCheckInCount(address: string, count: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(checkInCountKey(address), String(Math.max(0, count)));
}

/** Optimistic +1 after a confirmed check-in tx (before history re-indexes). */
export function bumpLocalCheckInCount(address: string, onChainFloor: number): number {
  const next = Math.max(readLocalCheckInCount(address), onChainFloor) + 1;
  writeLocalCheckInCount(address, next);
  return next;
}

export function readLocalBoostCount(address: string): number {
  if (typeof window === "undefined") return 0;
  const n = parseInt(localStorage.getItem(boostsKey(address)) || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function writeLocalBoostCount(address: string, count: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(boostsKey(address), String(Math.max(0, count)));
}

/** On-chain count is floor; local session boosts can run ahead until indexer catches up. */
export function resolveBoostCount(onChainBoosts: number, address: string): number {
  const chain = Math.max(0, onChainBoosts);
  const local = readLocalBoostCount(address);
  // Only clamp obvious corruption — never cap normal rapid-fire boosting
  if (local > chain + 100) {
    writeLocalBoostCount(address, chain);
    return chain;
  }
  const resolved = Math.max(chain, local);
  if (local !== resolved) writeLocalBoostCount(address, resolved);
  return resolved;
}

/** Total check-ins — allow session count ahead of indexer like boosts. */
export function resolveCheckInCount(onChainCount: number, address: string): number {
  const chain = Math.max(0, onChainCount);
  const local = readLocalCheckInCount(address);
  if (local > chain + 100) {
    writeLocalCheckInCount(address, chain);
    return chain;
  }
  const resolved = Math.max(chain, local);
  if (local !== resolved) writeLocalCheckInCount(address, resolved);
  return resolved;
}

export function readReferralBonusXpForAddress(address: string): number {
  if (typeof window === "undefined") return 0;
  const key = referralBonusKey(address);
  const perWallet = parseInt(localStorage.getItem(key) || "0", 10);
  if (perWallet > 0) return perWallet;
  const legacy = parseInt(localStorage.getItem("base_referral_bonus_xp") || "0", 10);
  if (legacy > 0) {
    localStorage.setItem(key, String(legacy));
    localStorage.removeItem("base_referral_bonus_xp");
    return legacy;
  }
  return 0;
}

export function setReferralBonusXpForAddress(address: string, xp: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(referralBonusKey(address), String(Math.max(0, xp)));
}

/** App session counters only — quests must be completed in-app, not from chain history. */
export function deriveTxKeysFromAnalysis(
  _result: AnalyzeWalletResult
): Record<string, number> {
  return { ...DEFAULT_TX_KEYS };
}

/** Keep Transaction remount counters when re-syncing from on-chain analysis. */
export function mergeTxKeyCounters(
  derived: Record<string, number>,
  current: Record<string, number>
): Record<string, number> {
  return {
    boost: Math.max(derived.boost || 0, current.boost || 0),
    gm: Math.max(derived.gm || 0, current.gm || 0),
    gn: Math.max(derived.gn || 0, current.gn || 0),
    checkin: Math.max(derived.checkin || 0, current.checkin || 0),
  };
}

export function syncSessionFromAnalysis(
  address: string,
  result: AnalyzeWalletResult
): { boosts: number; checkInCount: number; txKeys: Record<string, number> } {
  const boosts = resolveBoostCount(result.boosts, address);
  const checkInCount = resolveCheckInCount(result.wallet.checkInCount, address);
  const txKeys = {
    ...DEFAULT_TX_KEYS,
    ...readPersistedTxKeys(address),
  };
  writePersistedTxKeys(address, txKeys);
  return { boosts, checkInCount, txKeys };
}

export function clearWalletActionSession(address: string): void {
  if (typeof window === "undefined" || !address) return;
  const key = addrKey(address);
  localStorage.removeItem(boostsKey(address));
  localStorage.removeItem(txKeysKey(address));
  localStorage.removeItem(checkInCountKey(address));
  localStorage.removeItem(`base_gm_${key}`);
}

export function bumpBoostCount(address: string, onChainFloor: number): number {
  const chain = Math.max(0, onChainFloor);
  const local = readLocalBoostCount(address);
  const next = Math.max(local, chain) + 1;
  writeLocalBoostCount(address, next);
  return next;
}
