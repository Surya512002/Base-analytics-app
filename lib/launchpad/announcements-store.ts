import { randomUUID } from "node:crypto";
import { cacheGet, cacheSet } from "@/lib/redis-cache";
import type { TokenAnnouncement } from "@/lib/launchpad/types";
import { getLaunchedToken } from "@/lib/launchpad/token-store";

const MAX_ANNOUNCEMENTS = 50;
const TTL = 60 * 60 * 24 * 365;

const mem = new Map<string, TokenAnnouncement[]>();

function key(token: string): string {
  return `launchpad:announcements:${token.toLowerCase()}`;
}

export async function listAnnouncements(token: string): Promise<TokenAnnouncement[]> {
  const k = key(token);
  const cached = await cacheGet<TokenAnnouncement[]>(k);
  if (cached) return cached;
  return mem.get(k) ?? [];
}

export async function addAnnouncement(
  token: string,
  creator: string,
  body: string
): Promise<{ ok: boolean; error?: string; announcements?: TokenAnnouncement[] }> {
  const tokenAddr = token.trim().toLowerCase();
  const creatorAddr = creator.trim().toLowerCase();
  const text = body.trim();

  if (!tokenAddr.startsWith("0x") || tokenAddr.length !== 42) {
    return { ok: false, error: "Invalid token" };
  }
  if (!creatorAddr.startsWith("0x") || creatorAddr.length !== 42) {
    return { ok: false, error: "Invalid creator" };
  }
  if (!text || text.length > 500) {
    return { ok: false, error: "Announcement must be 1–500 characters" };
  }

  const registered = await getLaunchedToken(tokenAddr);
  if (!registered) {
    return { ok: false, error: "Token not found" };
  }
  if (registered.creator.toLowerCase() !== creatorAddr) {
    return { ok: false, error: "Only the token creator can post announcements" };
  }

  const entry: TokenAnnouncement = {
    id: randomUUID(),
    body: text,
    createdAt: Date.now(),
    creator: creatorAddr,
  };

  const k = key(tokenAddr);
  const existing = await listAnnouncements(tokenAddr);
  const next = [entry, ...existing].slice(0, MAX_ANNOUNCEMENTS);
  mem.set(k, next);
  await cacheSet(k, next, TTL).catch(() => {});
  return { ok: true, announcements: next };
}
