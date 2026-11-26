/**
 * The 3,100+ Base token catalog (about 750 KB). Server code imports it directly; browser code
 * must use `loadTokenCatalog` (./load-token-catalog) so it stays out of the first page load.
 */
import { VERIFIED_BASE_CRYPTO_TOKENS, type VerifiedTokenDef } from "./verified-tokens";
import verifiedTokensJson from "./verified-base-tokens.json";

/** Comprehensive list of 3,100+ Base catalog tokens from CoinGecko, Superchain, & Coinbase (used for asset discovery/pricing) */
export const ALL_VERIFIED_BASE_TOKENS: VerifiedTokenDef[] = verifiedTokensJson as VerifiedTokenDef[];

// Fast O(1) indexed lookup maps for 3,100+ Base catalog tokens
const VERIFIED_TOKENS_BY_ADDRESS = new Map<string, VerifiedTokenDef>();
const VERIFIED_TOKENS_BY_SYMBOL = new Map<string, VerifiedTokenDef>();

for (const t of ALL_VERIFIED_BASE_TOKENS) {
  const addr = t.address.toLowerCase();
  const sym = t.symbol.toLowerCase();
  if (!VERIFIED_TOKENS_BY_ADDRESS.has(addr)) {
    VERIFIED_TOKENS_BY_ADDRESS.set(addr, t);
  }
  if (!VERIFIED_TOKENS_BY_SYMBOL.has(sym)) {
    VERIFIED_TOKENS_BY_SYMBOL.set(sym, t);
  }
}

for (const t of VERIFIED_BASE_CRYPTO_TOKENS) {
  const addr = t.address.toLowerCase();
  const sym = t.symbol.toLowerCase();
  const existing = VERIFIED_TOKENS_BY_ADDRESS.get(addr);
  const merged: VerifiedTokenDef = {
    ...t,
    logoURI: t.logoURI || existing?.logoURI || null,
  };
  VERIFIED_TOKENS_BY_ADDRESS.set(addr, merged);
  VERIFIED_TOKENS_BY_SYMBOL.set(sym, merged);
}

/**
 * Fast lookup for a catalog token by address or symbol
 */
export function findVerifiedToken(addressOrSymbol: string): VerifiedTokenDef | undefined {
  if (!addressOrSymbol) return undefined;
  const raw = addressOrSymbol.trim().toLowerCase();
  return VERIFIED_TOKENS_BY_ADDRESS.get(raw) || VERIFIED_TOKENS_BY_SYMBOL.get(raw);
}

/**
 * Direct logo URL resolver from verified 3,100+ Base token catalog
 */
export function getVerifiedTokenLogo(addressOrSymbol?: string | null): string | null {
  if (!addressOrSymbol) return null;
  const found = findVerifiedToken(addressOrSymbol);
  return found?.logoURI || null;
}

/**
 * Searches across all 3,100+ Base catalog tokens by symbol, name, or address
 */
export function searchVerifiedTokens(query: string, limit = 50): VerifiedTokenDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: VerifiedTokenDef[] = [];
  const seen = new Set<string>();

  for (const t of ALL_VERIFIED_BASE_TOKENS) {
    const addr = t.address.toLowerCase();
    if (seen.has(addr)) continue;
    if (
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      addr === q
    ) {
      seen.add(addr);
      results.push(t);
      if (results.length >= limit) break;
    }
  }
  return results;
}
