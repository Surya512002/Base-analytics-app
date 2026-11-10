import { type Address, parseUnits } from "viem";
import { USDC_BASE } from "@/lib/launchpad/tokens-base";
import { quoteSlipstreamExactIn, quoteSlipstreamTickSpacing } from "@/lib/launchpad/slipstream";
import { quoteAerodromeRoute } from "@/lib/launchpad/aerodrome";
import {
  priceImpactBpsFromProbe,
  probeAmountFor,
} from "@/lib/launchpad/price-impact";
import type { ImpactSafetyResult } from "./types";

/**
 * Standard thresholds for price impact safety classification
 */
export const IMPACT_THRESHOLDS = {
  SAFE_MAX_PCT: 1.0,      // < 1% is green / safe
  MODERATE_MAX_PCT: 5.0,  // 1% - 5% is amber / caution
  HIGH_MAX_PCT: 15.0,     // 5% - 15% is red / warning
  // > 15% is critical / block
} as const;

/**
 * Categorize price impact percentage into standardized safety tier and UI badges
 */
export function computeTradeSafety(impactPct: number | null): ImpactSafetyResult {
  if (impactPct === null || isNaN(impactPct)) {
    return {
      impactPct: 0,
      tier: "safe",
      action: "allow",
      badgeColorClass: "text-[var(--ink-muted)] bg-[var(--surface-2)] border-[var(--border-subtle)]",
      badgeLabel: "Impact Unknown",
      title: "Impact Not Measured",
      message: "Liquidity is unverified. Proceed with caution.",
      suggestion: null,
    };
  }

  const cleanPct = Math.max(0, Number(impactPct.toFixed(2)));

  if (cleanPct < IMPACT_THRESHOLDS.SAFE_MAX_PCT) {
    return {
      impactPct: cleanPct,
      tier: "safe",
      action: "allow",
      badgeColorClass: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40",
      badgeLabel: `< 1% Impact`,
      title: "Low Price Impact",
      message: "Sufficient liquidity. Market trade will execute near spot price.",
      suggestion: null,
    };
  }

  if (cleanPct <= IMPACT_THRESHOLDS.MODERATE_MAX_PCT) {
    return {
      impactPct: cleanPct,
      tier: "moderate",
      action: "warn",
      badgeColorClass: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40",
      badgeLabel: `${cleanPct.toFixed(2)}% Impact`,
      title: "Moderate Price Impact",
      message: `Executing this trade moves the market price by ${cleanPct.toFixed(2)}%.`,
      suggestion: "Consider reducing trade size or reviewing minimum received amount.",
    };
  }

  if (cleanPct <= IMPACT_THRESHOLDS.HIGH_MAX_PCT) {
    return {
      impactPct: cleanPct,
      tier: "high",
      action: "warn",
      badgeColorClass: "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40",
      badgeLabel: `${cleanPct.toFixed(2)}% High Impact`,
      title: "High Price Impact Warning",
      message: `Severe slippage: this order size moves pool price by ${cleanPct.toFixed(2)}%.`,
      suggestion: "Split this trade into smaller batches or use a Limit Order to avoid slippage.",
    };
  }

  return {
    impactPct: cleanPct,
    tier: "critical",
    action: "block",
    badgeColorClass: "text-red-900 dark:text-red-100 bg-red-100 dark:bg-red-950 border-red-400 dark:border-red-800",
    badgeLabel: `${cleanPct.toFixed(2)}% Critical Impact`,
    title: "Critical Price Impact — Risk of Loss",
    message: `Illiquid market: executing this trade directly will cause ${cleanPct.toFixed(2)}% loss in price impact.`,
    suggestion: "Market order strongly discouraged. Use a Limit Order or wait for deeper pool liquidity.",
  };
}

/**
 * Calculates the realized price impact of a $10,000 USD trade (USDC -> Tokenized Stock)
 * using on-chain Slipstream / Aerodrome router quotes with honest marginal probe.
 */
export async function calculatePriceImpactOn10k(
  stockAddress: Address,
  _stockDecimals = 8
): Promise<number | null> {
  try {
    // 10,000 USDC (6 decimals)
    const amountIn10k = parseUnits("10000", 6);
    const probeIn = probeAmountFor(amountIn10k); // $10 probe

    // 1. First probe Aerodrome Slipstream (concentrated pool)
    const slipQuote = await quoteSlipstreamExactIn(USDC_BASE, stockAddress, amountIn10k);
    if (slipQuote.hasLiquidity && slipQuote.amountOut > BigInt(0)) {
      const probeOut = await quoteSlipstreamTickSpacing(
        USDC_BASE,
        stockAddress,
        probeIn,
        slipQuote.tickSpacing
      );

      if (probeOut > BigInt(0)) {
        const bps = priceImpactBpsFromProbe({
          amountIn: amountIn10k,
          amountOut: slipQuote.amountOut,
          probeIn,
          probeOut,
        });
        if (bps !== null) {
          return Number((bps / 100).toFixed(4));
        }
      }
    }

    // 2. Fallback to Aerodrome classic pool (volatile pool stable=false)
    const aeroQuote = await quoteAerodromeRoute(USDC_BASE, stockAddress, amountIn10k, false);
    if (aeroQuote.hasLiquidity && aeroQuote.amountOut > BigInt(0)) {
      const aeroProbe = await quoteAerodromeRoute(USDC_BASE, stockAddress, probeIn, false);
      if (aeroProbe.hasLiquidity && aeroProbe.amountOut > BigInt(0)) {
        const bps = priceImpactBpsFromProbe({
          amountIn: amountIn10k,
          amountOut: aeroQuote.amountOut,
          probeIn,
          probeOut: aeroProbe.amountOut,
        });
        if (bps !== null) {
          return Number((bps / 100).toFixed(4));
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}
