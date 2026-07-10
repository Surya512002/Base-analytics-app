import type { LaunchedToken } from "@/lib/launchpad/types";
import { cacheGet, cacheSet } from "@/lib/redis-cache";

const REGISTRY_KEY = "launchpad:tokens:v1";
const REGISTRY_TTL = 60 * 60 * 24 * 365;
const MAX_TOKENS = 500;

const memTokens: LaunchedToken[] = [];

function normalizeAddress(addr: string): string {
  return addr.toLowerCase();
}

function sortTokens(tokens: LaunchedToken[]): LaunchedToken[] {
  return [...tokens].sort((a, b) => b.createdAt - a.createdAt);
}

export async function listLaunchedTokens(): Promise<LaunchedToken[]> {
  const cached = await cacheGet<LaunchedToken[]>(REGISTRY_KEY);
  if (cached?.length) return sortTokens(cached);
  return sortTokens(memTokens);
}

export async function registerLaunchedToken(
  token: LaunchedToken
): Promise<LaunchedToken[]> {
  const addr = normalizeAddress(token.address);
  const entry: LaunchedToken = {
    ...token,
    address: addr,
    creator: token.creator.toLowerCase(),
    createdAt: token.createdAt || Date.now(),
  };

  const existing = await listLaunchedTokens();
  const filtered = existing.filter((t) => t.address !== addr);
  const next = sortTokens([entry, ...filtered]).slice(0, MAX_TOKENS);

  memTokens.length = 0;
  memTokens.push(...next);
  await cacheSet(REGISTRY_KEY, next, REGISTRY_TTL).catch(() => {});
  return next;
}

export async function getLaunchedToken(
  address: string
): Promise<LaunchedToken | null> {
  const list = await listLaunchedTokens();
  return list.find((t) => t.address === normalizeAddress(address)) ?? null;
}

export async function patchLaunchedToken(
  address: string,
  patch: Partial<LaunchedToken>
): Promise<LaunchedToken | null> {
  const addr = normalizeAddress(address);
  const existing = await listLaunchedTokens();
  const idx = existing.findIndex((t) => t.address === addr);
  if (idx < 0) return null;

  const updated: LaunchedToken = {
    ...existing[idx]!,
    ...patch,
    address: addr,
    creator: (patch.creator ?? existing[idx]!.creator).toLowerCase(),
  };
  const next = [...existing];
  next[idx] = updated;
  const sorted = sortTokens(next);

  memTokens.length = 0;
  memTokens.push(...sorted);
  await cacheSet(REGISTRY_KEY, sorted, REGISTRY_TTL).catch(() => {});
  return updated;
}
