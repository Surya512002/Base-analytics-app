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

// shortcut: NYSE's published calendar for 2026 and 2027; add later years before 2028 (nyse.com/markets/hours-calendars).
const HOLIDAYS = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);
/** Days the market shuts at 1:00 PM. */
const EARLY_CLOSES = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);

/**
 * Checks whether US equity markets (NYSE / NASDAQ) are currently in standard trading hours
 * (Monday - Friday, 9:30 AM - 4:00 PM US Eastern Time, less exchange holidays and early closes).
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

    // en-CA writes dates as YYYY-MM-DD.
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
    if (HOLIDAYS.has(date)) {
      return {
        isOpen: false,
        statusText: "Market Closed (Holiday)",
        nextSessionText: "Opens Next Session 9:30 AM ET",
      };
    }

    const timeInMinutes = (hour % 24) * 60 + minute;
    const openTime = 9 * 60 + 30; // 9:30 AM
    const early = EARLY_CLOSES.has(date);
    const closeTime = (early ? 13 : 16) * 60;

    if (timeInMinutes >= openTime && timeInMinutes < closeTime) {
      return {
        isOpen: true,
        statusText: "Market Open (Regular Hours)",
        nextSessionText: early ? "Closes early, 1:00 PM ET" : "Closes 4:00 PM ET",
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
