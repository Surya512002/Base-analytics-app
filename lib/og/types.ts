import { OG_VERSION } from "./brand-kit";

export interface OgTokenCardData {
  address: string;
  symbol: string;
  name?: string;
  /** Price, change and market cap are present only when fetched live, together with `asOf`. */
  price?: string;
  change24h?: number;
  mcap?: string;
  asOf?: Date;
}

export const OG_SIZE = { width: 1200, height: 630 };

export function shortenAddress(addr: string): string {
  const a = addr.trim();
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

/** A token's sharing image. Only the address travels in the link; the server looks up the rest. */
export function getTokenOgImageUrl(baseUrl: string, address: string): string {
  const params = new URLSearchParams({ v: "token", addr: address.toLowerCase(), ogv: OG_VERSION });
  return `${baseUrl}/api/og?${params}`;
}
