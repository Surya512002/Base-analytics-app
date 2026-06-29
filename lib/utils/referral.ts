const REF_KEY = "base_referrer";
const REF_COUNT_KEY = "base_referral_count";
const REF_BONUS_KEY = "base_referral_bonus_xp";

export function readStoredReferrer(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REF_KEY);
}

export function storeReferrer(code: string) {
  if (typeof window === "undefined" || !code) return;
  if (!localStorage.getItem(REF_KEY)) {
    localStorage.setItem(REF_KEY, code.toLowerCase());
  }
}

export function readReferralBonusXp(address?: string): number {
  if (typeof window === "undefined") return 0;
  if (address) {
    const key = `base_referral_bonus_xp_${address.toLowerCase()}`;
    const perWallet = parseInt(localStorage.getItem(key) || "0", 10);
    if (perWallet > 0) return perWallet;
  }
  return parseInt(localStorage.getItem(REF_BONUS_KEY) || "0", 10);
}

export function setReferralBonusXp(xp: number, address?: string) {
  if (typeof window === "undefined") return;
  if (address) {
    localStorage.setItem(
      `base_referral_bonus_xp_${address.toLowerCase()}`,
      String(xp)
    );
    return;
  }
  localStorage.setItem(REF_BONUS_KEY, String(xp));
}

export function readReferralInviteCount(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(REF_COUNT_KEY) || "0", 10);
}

export async function registerReferralJoin(
  address: string,
  referrerCode: string | null
): Promise<{ bonusXp: number; referredBy: string | null }> {
  if (!referrerCode?.trim()) return { bonusXp: 0, referredBy: null };
  try {
    const res = await fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, referrer: referrerCode.trim() }),
    });
    if (!res.ok) return { bonusXp: 0, referredBy: null };
    const data = (await res.json()) as { bonusXp?: number; referredBy?: string };
    const bonus = data.bonusXp ?? 0;
    if (bonus > 0) setReferralBonusXp(bonus, address);
    return { bonusXp: bonus, referredBy: data.referredBy ?? null };
  } catch {
    return { bonusXp: 0, referredBy: null };
  }
}

export async function fetchReferralStats(address: string) {
  try {
    const res = await fetch(`/api/referral?address=${encodeURIComponent(address)}`);
    if (!res.ok) return { invites: 0, bonusXp: readReferralBonusXp(address) };
    return (await res.json()) as { invites: number; bonusXp: number };
  } catch {
    return { invites: 0, bonusXp: readReferralBonusXp(address) };
  }
}
