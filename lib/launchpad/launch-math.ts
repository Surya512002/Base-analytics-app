import { parseUnits, formatUnits } from "viem";
import { FIXED_LAUNCH_SUPPLY } from "@/lib/launchpad/launch-config";

export const SCALE_18 = BigInt("1000000000000000000"); // 1e18
export const DEFAULT_TOTAL_SUPPLY_BIGINT = BigInt("1000000000") * SCALE_18; // 1B tokens with 18 decimals

export function formatUsdSubscript(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "$0";
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  const str = price.toFixed(12);
  const match = str.match(/^0\.(0*)([1-9]\d?)/);
  if (!match) {
    const s = price.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
    return `$${s === "0" ? "<0.00000001" : s}`;
  }
  const zeros = match[1].length;
  const tail = match[2].padEnd(5, "0").slice(0, 5);
  const sub = String(zeros).split("").map((d) => String.fromCharCode(0x2080 + parseInt(d, 10))).join("");
  return `$0.0${sub}${tail}`;
}

export function formatEthSubscript(eth: number): string {
  if (!Number.isFinite(eth) || eth <= 0) return "0 ETH";
  if (eth >= 0.0001) return `${eth.toFixed(6)} ETH`;
  const str = eth.toFixed(18);
  const match = str.match(/^0\.(0*)([1-9]\d?)/);
  if (!match) {
    const s = eth.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
    return `${s === "0" ? "<0.00000001" : s} ETH`;
  }
  const zeros = match[1].length;
  const tail = match[2].padEnd(5, "0").slice(0, 5);
  const sub = String(zeros).split("").map((d) => String.fromCharCode(0x2080 + parseInt(d, 10))).join("");
  return `0.0${sub}${tail} ETH`;
}

/**
 * High-precision BigInt calculation for Token Launch Economics.
 * Avoids any IEEE-754 floating point precision loss.
 * Handles 6 (USDC), 8 (Stock / WBTC), and 18 (ETH / WETH) quote decimals.
 */
export function computeLaunchEconomicsBigInt(params: {
  startPriceUsd: string;
  quotePriceUsd: number | string;
  quoteDecimals?: number; // 6, 8, 18
  totalSupplyCount?: bigint; // Default 1,000,000,000 whole tokens
}): {
  pricePerTokenInQuoteWei: bigint;
  marketCapUsdWei: bigint; // scaled by 1e18
  marketCapInQuoteWei: bigint;
  formattedPriceQuote: string;
  formattedMarketCapUsd: string;
  formattedMarketCapQuote: string;
} {
  const quoteDec = params.quoteDecimals ?? 18;
  const supplyCount = params.totalSupplyCount ?? BigInt("1000000000"); // 1 Billion tokens

  // Parse startPriceUsd into 18-decimal fixed point
  let startPriceWei = BigInt(0);
  try {
    const cleanPrice = (params.startPriceUsd || "0").trim();
    startPriceWei = parseUnits(cleanPrice, 18);
  } catch {
    startPriceWei = BigInt(0);
  }

  // Parse quotePriceUsd into 18-decimal fixed point
  let quotePriceWei = BigInt(0);
  try {
    const cleanQuote = String(params.quotePriceUsd || "0").trim();
    quotePriceWei = parseUnits(cleanQuote, 18);
  } catch {
    quotePriceWei = BigInt(0);
  }

  // Market Cap in USD (1e18 scale): startPriceWei * supplyCount
  const marketCapUsdWei = startPriceWei * supplyCount;

  // Price per token in Quote currency:
  // priceInQuote = (startPriceWei * 10^quoteDec) / quotePriceWei
  let pricePerTokenInQuoteWei = BigInt(0);
  let marketCapInQuoteWei = BigInt(0);

  if (quotePriceWei > BigInt(0)) {
    const quoteScale = BigInt(10) ** BigInt(quoteDec);
    pricePerTokenInQuoteWei = (startPriceWei * quoteScale) / quotePriceWei;
    marketCapInQuoteWei = pricePerTokenInQuoteWei * supplyCount;
  }

  // Format strings
  const formattedMarketCapUsd = formatBigIntCompactUsd(marketCapUsdWei);
  const formattedMarketCapQuote = formatUnits(marketCapInQuoteWei, quoteDec);
  const formattedPriceQuote = formatUnits(pricePerTokenInQuoteWei, quoteDec);

  return {
    pricePerTokenInQuoteWei,
    marketCapUsdWei,
    marketCapInQuoteWei,
    formattedPriceQuote,
    formattedMarketCapUsd,
    formattedMarketCapQuote,
  };
}

/**
 * Format a 18-decimal USD BigInt into compact $K, $M, $B string
 */
export function formatBigIntCompactUsd(usdWei: bigint): string {
  if (usdWei <= BigInt(0)) return "$0.00";
  const whole = usdWei / SCALE_18;
  const rem = (usdWei % SCALE_18) / BigInt("10000000000000000"); // 2 decimals

  if (whole >= BigInt(1_000_000_000)) {
    const b = Number(whole) / 1e9;
    return `$${b.toFixed(2)}B`;
  }
  if (whole >= BigInt(1_000_000)) {
    const m = Number(whole) / 1e6;
    return `$${m.toFixed(2)}M`;
  }
  if (whole >= BigInt(1_000)) {
    const k = Number(whole) / 1e3;
    return `$${k.toFixed(2)}K`;
  }
  return `$${whole.toString()}.${rem.toString().padStart(2, "0")}`;
}

export function computeLaunchEconomics(
  startPriceUsd: string,
  ethUsd: number,
  quoteDecimals = 18
): {
  priceUsd: number;
  priceEth: number;
  marketCapUsd: number;
  marketCapEth: number;
  priceUsdLabel: string;
  priceEthLabel: string;
  marketCapUsdLabel: string;
  marketCapEthLabel: string;
} {
  const priceUsd = parseFloat(startPriceUsd) || 0;
  const supply = parseFloat(FIXED_LAUNCH_SUPPLY);
  const priceEth = ethUsd > 0 ? priceUsd / ethUsd : 0;
  const marketCapUsd = priceUsd * supply;
  const marketCapEth = priceEth * supply;

  // Utilize BigInt calculation for exact market cap label
  const bigIntEcon = computeLaunchEconomicsBigInt({
    startPriceUsd,
    quotePriceUsd: ethUsd,
    quoteDecimals,
  });

  return {
    priceUsd,
    priceEth,
    marketCapUsd,
    marketCapEth,
    priceUsdLabel: formatUsdSubscript(priceUsd),
    priceEthLabel: formatEthSubscript(priceEth),
    marketCapUsdLabel: bigIntEcon.formattedMarketCapUsd,
    marketCapEthLabel:
      marketCapEth >= 1 ? `${marketCapEth.toFixed(3)} ETH` : formatEthSubscript(marketCapEth),
  };
}
