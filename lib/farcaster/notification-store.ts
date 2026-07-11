import { cacheGet, cacheSet } from "@/lib/redis-cache";

const KEY_PREFIX = "fc:webhook:v1:";
const TTL = 60 * 60 * 24 * 365;

export type FarcasterNotificationDetails = {
  url: string;
  token: string;
};

export async function setFarcasterNotificationDetails(
  fid: number,
  details: FarcasterNotificationDetails | null
): Promise<void> {
  const key = `${KEY_PREFIX}${fid}`;
  if (!details) {
    await cacheSet(key, { deleted: true }, 60).catch(() => {});
    return;
  }
  await cacheSet(key, details, TTL).catch(() => {});
}

export async function getFarcasterNotificationDetails(
  fid: number
): Promise<FarcasterNotificationDetails | null> {
  const key = `${KEY_PREFIX}${fid}`;
  const data = await cacheGet<FarcasterNotificationDetails | { deleted: true }>(key);
  if (!data || "deleted" in data) return null;
  return data;
}
