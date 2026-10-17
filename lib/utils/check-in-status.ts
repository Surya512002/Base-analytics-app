import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { CHECKIN_ABI, CHECKIN_CONTRACT } from "@/lib/constants/contracts";
import { BASE_RPC } from "@/lib/constants/env";
import { readWalletCache, writeWalletCache } from "@/lib/utils/wallet-cache";
import {
  bumpLocalCheckInCount,
  resolveCheckInCount,
} from "@/lib/utils/wallet-session";

export function todayUtcKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function checkInLocalKey(address: string): string {
  return `base_checkin_${address.toLowerCase()}`;
}

export function readLocalCheckInToday(address: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(checkInLocalKey(address)) === todayUtcKey();
}

export function writeLocalCheckInToday(address: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(checkInLocalKey(address), todayUtcKey());
}

export function checkInTimestampKey(address: string): string {
  return `base_checkin_ts_${address.toLowerCase()}`;
}

export function readLocalLastCheckInTime(address: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(checkInTimestampKey(address));
  if (!raw) return null;
  const num = parseInt(raw, 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function writeLocalLastCheckInTime(address: string, timestampSec: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(checkInTimestampKey(address), String(timestampSec));
}

/** Call only after a successful onchain check-in transaction. */
export function recordCheckInSuccess(
  address: string,
  onChainFloor = 0
): number {
  writeLocalCheckInToday(address);
  writeLocalLastCheckInTime(address, Math.floor(Date.now() / 1000));
  return bumpLocalCheckInCount(address, onChainFloor);
}

export async function fetchCheckInStatus(
  address: string
): Promise<{ checkedToday: boolean; streak: number; lastCheckIn?: number }> {
  const localToday = readLocalCheckInToday(address);
  const localLastTs = readLocalLastCheckInTime(address);

  if (!CHECKIN_CONTRACT || !BASE_RPC) {
    return { checkedToday: localToday, streak: 0, lastCheckIn: localLastTs ?? undefined };
  }

  try {
    const pub = createPublicClient({
      chain: base,
      transport: http(BASE_RPC, { timeout: 12_000 }),
    });
    const [streakRaw, lastCheckIn] = await Promise.all([
      pub.readContract({
        address: CHECKIN_CONTRACT as `0x${string}`,
        abi: CHECKIN_ABI,
        functionName: "streaks",
        args: [address as `0x${string}`],
      }),
      pub.readContract({
        address: CHECKIN_CONTRACT as `0x${string}`,
        abi: CHECKIN_ABI,
        functionName: "lastCheckIn",
        args: [address as `0x${string}`],
      }),
    ]);

    const lastTs = Number(lastCheckIn);
    const onChainToday =
      lastTs > 0 &&
      new Date(lastTs * 1000).toISOString().slice(0, 10) === todayUtcKey();

    if (onChainToday) writeLocalCheckInToday(address);
    if (lastTs > 0) writeLocalLastCheckInTime(address, lastTs);

    return {
      checkedToday: onChainToday || localToday,
      streak: Number(streakRaw),
      lastCheckIn: lastTs > 0 ? lastTs : (localLastTs ?? undefined),
    };
  } catch {
    return { checkedToday: localToday, streak: 0, lastCheckIn: localLastTs ?? undefined };
  }
}

export function patchCheckInInWalletCache(
  address: string,
  checkedToday: boolean,
  streak: number,
  incrementCount = false
): void {
  const cached = readWalletCache(address);
  if (!cached) return;
  const checkInCount = incrementCount
    ? resolveCheckInCount(cached.wallet.checkInCount + 1, address)
    : resolveCheckInCount(cached.wallet.checkInCount, address);
  writeWalletCache(
    address,
    {
      ...cached,
      checkedToday,
      streak,
      wallet: { ...cached.wallet, checkInCount },
    },
    true
  );
}
