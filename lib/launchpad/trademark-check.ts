import { TOKENIZED_STOCKS_REGISTRY } from "@/lib/stocks/tokenized-stocks-registry";

export interface TrademarkCheckResult {
  hasWarning: boolean;
  hasCollision: boolean;
  matchedCompany?: string;
  matchedTicker?: string;
  warningMessage?: string;
  reason?: string;
}

function hasWordBoundaryMatch(text: string, keyword: string): boolean {
  if (!keyword || keyword.length < 3) return false;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|\\s|[.,!?;:"'\\/\\-_])${escaped}($|\\s|[.,!?;:"'\\/\\-_])`, "i");
  return regex.test(text);
}

/**
 * Checks a proposed token name and symbol against known public equity brands
 * and tickers in the tokenized stock registry to warn creators against trademark misuse.
 */
export function checkTrademarkCollision(name: string, symbol: string): TrademarkCheckResult {
  const cleanName = name.trim().toLowerCase();
  const cleanSymbol = symbol.trim().toLowerCase().replace(/^\$/, "");

  if (!cleanName && !cleanSymbol) {
    return { hasWarning: false, hasCollision: false };
  }

  for (const stock of TOKENIZED_STOCKS_REGISTRY) {
    const stockNameLower = stock.name.toLowerCase();
    const tickerLower = stock.underlyingTicker.toLowerCase();
    const tokenSymbolLower = stock.symbol.toLowerCase();

    // Check exact ticker collision
    if (cleanSymbol && (cleanSymbol === tickerLower || cleanSymbol === tokenSymbolLower)) {
      const msg = `Symbol "$${symbol.toUpperCase()}" matches the equity ticker for ${stock.name}. Ensure your token does not impersonate or infringe on existing corporate trademarks.`;
      return {
        hasWarning: true,
        hasCollision: true,
        matchedCompany: stock.name,
        matchedTicker: stock.underlyingTicker,
        warningMessage: msg,
        reason: msg,
      };
    }

    // Check company name collision using proper word boundaries to prevent substring false-positives
    // (e.g. "intelligence" should not falsely match "Intel")
    if (cleanName && cleanName.length >= 4) {
      const stockCoreName = stockNameLower.replace(/\s+(inc\.?|corp\.?|corporation|ltd\.?|co\.?|plc)$/i, "").trim();
      if (
        cleanName === stockNameLower ||
        cleanName === stockCoreName ||
        hasWordBoundaryMatch(cleanName, stockNameLower) ||
        hasWordBoundaryMatch(cleanName, stockCoreName) ||
        (cleanName.length >= 5 && hasWordBoundaryMatch(stockNameLower, cleanName))
      ) {
        const msg = `Token name "${name}" resembles registered company name "${stock.name}". Ensure your token branding does not impersonate or mislead users.`;
        return {
          hasWarning: true,
          hasCollision: true,
          matchedCompany: stock.name,
          matchedTicker: stock.underlyingTicker,
          warningMessage: msg,
          reason: msg,
        };
      }
    }
  }

  return { hasWarning: false, hasCollision: false };
}
