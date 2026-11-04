/**
 * Tokenized Stock NAV Tracker Engine
 * Compares 24/5 official Oracle NAV against 24/7 Base DEX AMM prices.
 * Provides market hours detection and custody/attestation links.
 * Zero mock numbers — displays "Unavailable" if data is missing.
 */

export interface StockNavComparison {
  symbol: string;
  name: string;
  contractAddress: string;
  dexPriceUsd: number | null;
  oracleNavUsd: number | null;
  spreadUsd: number | null;
  spreadPct: number | null;
  status: "par" | "premium" | "discount" | "unavailable";
  statusLabel: string;
  isMarketOpen: boolean;
  marketHoursNote: string;
  attestationUrl: string;
  explorerUrl: string;
}

/**
 * Checks whether US equity markets (NYSE / NASDAQ) are currently in standard trading hours
 * (Monday - Friday, 9:30 AM - 4:00 PM US Eastern Time).
 */
export function getEquityMarketStatus(now: Date = new Date()): {
  isOpen: boolean;
  statusText: string;
  nextSessionText: string;
} {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const day = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "12", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

    const isWeekend = day === "Sat" || day === "Sun";
    if (isWeekend) {
      return {
        isOpen: false,
        statusText: "Market Closed (Weekend)",
        nextSessionText: "Opens Monday 9:30 AM ET",
      };
    }

    const timeInMinutes = hour * 60 + minute;
    const openTime = 9 * 60 + 30; // 9:30 AM
    const closeTime = 16 * 60; // 4:00 PM

    if (timeInMinutes >= openTime && timeInMinutes < closeTime) {
      return {
        isOpen: true,
        statusText: "Market Open (Regular Hours)",
        nextSessionText: "Closes 4:00 PM ET",
      };
    }

    return {
      isOpen: false,
      statusText: "Market Closed (After Hours)",
      nextSessionText: "Opens Next Session 9:30 AM ET",
    };
  } catch {
    return {
      isOpen: false,
      statusText: "Schedule Unavailable",
      nextSessionText: "24/7 Base AMM Active",
    };
  }
}

/**
 * Computes the NAV vs DEX AMM price spread.
 */
export function computeNavSpread(params: {
  symbol: string;
  name: string;
  contractAddress: string;
  dexPriceUsd: number | null;
  oracleNavUsd: number | null;
  now?: Date;
}): StockNavComparison {
  const { symbol, name, contractAddress, dexPriceUsd, oracleNavUsd, now = new Date() } = params;
  const marketStatus = getEquityMarketStatus(now);

  const explorerUrl = `https://basescan.org/token/${contractAddress}`;
  const attestationUrl = "https://backed.fi/legal/attestations";

  if (dexPriceUsd === null || oracleNavUsd === null || oracleNavUsd <= 0 || dexPriceUsd <= 0) {
    return {
      symbol,
      name,
      contractAddress,
      dexPriceUsd,
      oracleNavUsd,
      spreadUsd: null,
      spreadPct: null,
      status: "unavailable",
      statusLabel: "Unavailable",
      isMarketOpen: marketStatus.isOpen,
      marketHoursNote: marketStatus.statusText,
      attestationUrl,
      explorerUrl,
    };
  }

  const spreadUsd = Number((dexPriceUsd - oracleNavUsd).toFixed(4));
  const spreadPct = Number((((dexPriceUsd - oracleNavUsd) / oracleNavUsd) * 100).toFixed(2));

  let status: StockNavComparison["status"] = "par";
  let statusLabel = "Par (<= 0.5% Spread)";

  if (spreadPct > 0.5) {
    status = "premium";
    statusLabel = `Trading at +${spreadPct}% Premium`;
  } else if (spreadPct < -0.5) {
    status = "discount";
    statusLabel = `Trading at ${spreadPct}% Discount`;
  }

  return {
    symbol,
    name,
    contractAddress,
    dexPriceUsd,
    oracleNavUsd,
    spreadUsd,
    spreadPct,
    status,
    statusLabel,
    isMarketOpen: marketStatus.isOpen,
    marketHoursNote: `${marketStatus.statusText} · ${marketStatus.nextSessionText}`,
    attestationUrl,
    explorerUrl,
  };
}
