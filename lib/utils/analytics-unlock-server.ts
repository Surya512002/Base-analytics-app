import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { cacheGet, cacheSet } from "@/lib/redis-cache";

const COOKIE = "ba_analytics_unlock";
const TTL_SEC = 60 * 60 * 24 * 30; // 30 days

function unlockSecret(): string {
  return (
    process.env.SIWE_SESSION_SECRET?.trim() ||
    process.env.ALCHEMY_API_KEY?.trim() ||
    "dev-analytics-unlock"
  );
}

function redisKey(address: string): string {
  return `analytics:unlocked:${address.toLowerCase()}`;
}

function sign(payload: string): string {
  return createHmac("sha256", unlockSecret()).update(payload).digest("base64url");
}

export function createAnalyticsUnlockToken(address: string): string {
  const exp = Date.now() + TTL_SEC * 1000;
  const payload = Buffer.from(
    JSON.stringify({ address: address.toLowerCase(), exp }),
    "utf8"
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parseAnalyticsUnlockToken(
  token: string | undefined | null
): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      address?: string;
      exp?: number;
    };
    if (!data.address?.startsWith("0x") || !data.exp || Date.now() > data.exp) {
      return null;
    }
    return data.address.toLowerCase();
  } catch {
    return null;
  }
}

export async function markAnalyticsUnlocked(address: string): Promise<string> {
  const addr = address.toLowerCase();
  const token = createAnalyticsUnlockToken(addr);
  await cacheSet(redisKey(addr), { unlocked: true, at: Date.now() }, TTL_SEC);
  return token;
}

export async function isAnalyticsUnlockedServer(
  address: string,
  cookieToken?: string | null
): Promise<boolean> {
  const addr = address.toLowerCase();
  const cached = await cacheGet<{ unlocked?: boolean }>(redisKey(addr));
  if (cached?.unlocked) return true;
  const fromCookie = parseAnalyticsUnlockToken(cookieToken);
  return fromCookie === addr;
}

export async function readAnalyticsUnlockCookie(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export { COOKIE as ANALYTICS_UNLOCK_COOKIE, TTL_SEC as ANALYTICS_UNLOCK_TTL_SEC };
