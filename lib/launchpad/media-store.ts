import { cacheGet, cacheSet } from "@/lib/redis-cache";
import { randomBytes } from "crypto";

const MEDIA_PREFIX = "launchpad:media:";
const MEDIA_TTL = 60 * 60 * 24 * 90;
const MAX_BYTES = 600_000;

const memMedia = new Map<string, { mime: string; data: string }>();

export interface StoredMedia {
  mime: string;
  data: string;
}

export async function storeLaunchpadMedia(
  mime: string,
  base64: string
): Promise<string> {
  const id = randomBytes(12).toString("hex");
  const entry = { mime, data: base64 };
  memMedia.set(id, entry);
  await cacheSet(`${MEDIA_PREFIX}${id}`, entry, MEDIA_TTL).catch(() => {});
  return id;
}

export async function getLaunchpadMedia(
  id: string
): Promise<StoredMedia | null> {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  const cached = await cacheGet<StoredMedia>(`${MEDIA_PREFIX}${id}`);
  if (cached?.data) return cached;
  return memMedia.get(id) ?? null;
}

export function mediaPayloadTooLarge(bytes: number): boolean {
  return bytes > MAX_BYTES;
}
