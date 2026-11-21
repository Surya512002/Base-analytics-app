/**
 * What the Neynar proxy will forward. The proxy adds our paid API key to every request, so it
 * must not be a way to reach other Neynar endpoints: only the one lookup the app uses, with only
 * its `addresses` parameter, rebuilt from validated pieces (never copied from the request).
 */
const ALLOWED_PATH = "v2/farcaster/user/bulk-by-address";
const MAX_ADDRESSES = 25;

export function neynarProxyRequest(searchParams: URLSearchParams): { url: string } | { error: string } {
  if (searchParams.get("path") !== ALLOWED_PATH) return { error: "Invalid path" };
  const list = (searchParams.get("addresses") ?? "").split(",").map((a) => a.trim().toLowerCase());
  if (list.length === 0 || list.length > MAX_ADDRESSES || list.some((a) => !/^0x[0-9a-f]{40}$/.test(a))) {
    return { error: "addresses must be 1 to 25 wallet addresses" };
  }
  const url = new URL(`https://api.neynar.com/${ALLOWED_PATH}`);
  url.searchParams.set("addresses", list.join(","));
  return { url: url.toString() };
}
