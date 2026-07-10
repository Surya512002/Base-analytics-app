const KEY = "base_token_watchlist";

export function readTokenWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a): a is string => typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a))
      .map((a) => a.toLowerCase());
  } catch {
    return [];
  }
}

export function writeTokenWatchlist(addresses: string[]) {
  if (typeof window === "undefined") return;
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
  localStorage.setItem(KEY, JSON.stringify(unique));
}

export function isTokenWatched(address: string): boolean {
  return readTokenWatchlist().includes(address.toLowerCase());
}

export function toggleTokenWatch(address: string): boolean {
  const list = readTokenWatchlist();
  const lower = address.toLowerCase();
  const next = list.includes(lower) ? list.filter((a) => a !== lower) : [...list, lower];
  writeTokenWatchlist(next);
  return next.includes(lower);
}
