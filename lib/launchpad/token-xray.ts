/**
 * Token X-Ray Safety Analysis Engine
 * Evaluates Base token contracts for 0-100 safety score:
 * - LP Lock / Liquidity Health (0-25 pts)
 * - Holder Concentration / Whales (0-25 pts)
 * - Mint Privileges & Admin Ownership (0-25 pts)
 * - Sell Simulation / Honeypot / Anti-Snipe (0-25 pts)
 */

export interface TokenXRayReport {
  address: string;
  score: number; // 0 to 100
  tier: "low_risk" | "moderate_risk" | "high_risk";
  tierLabel: string;
  summary: string;
  factors: {
    lpLockScore: number;
    lpLockStatus: string;
    concentrationScore: number;
    top10ConcentrationPct: number;
    privilegeScore: number;
    privilegeStatus: string;
    honeypotScore: number;
    honeypotStatus: string;
  };
  reasons: string[];
  warnings: string[];
  timestamp: number;
}

export interface EvaluateSafetyParams {
  address: string;
  symbol?: string;
  liquidityUsd?: number;
  top10Pct?: number;
  isOwnerRenounced?: boolean;
  hasMintFunction?: boolean;
  isHoneypot?: boolean;
  buyTaxPct?: number;
  sellTaxPct?: number;
  antiSnipeActive?: boolean;
  isVerified?: boolean;
}

export function computeTokenXRayScore(params: EvaluateSafetyParams): TokenXRayReport {
  const {
    address,
    liquidityUsd = 0,
    top10Pct = 25,
    isOwnerRenounced = true,
    hasMintFunction = false,
    isHoneypot = false,
    buyTaxPct = 0,
    sellTaxPct = 0,
    antiSnipeActive = false,
    isVerified = false,
  } = params;

  const reasons: string[] = [];
  const warnings: string[] = [];

  // 1. LP Lock & Liquidity Health (0 - 25 pts)
  let lpLockScore = 15;
  let lpLockStatus = "Standard pool liquidity";

  if (liquidityUsd >= 50_000 || isVerified) {
    lpLockScore = 25;
    lpLockStatus = "Deep liquidity pool ($50k+)";
    reasons.push("Deep liquidity reserves on Base DEXs");
  } else if (liquidityUsd >= 10_000) {
    lpLockScore = 20;
    lpLockStatus = "Adequate liquidity reserves ($10k+)";
    reasons.push("Adequate liquidity ($10k+) supports standard swaps");
  } else if (liquidityUsd > 0) {
    lpLockScore = 12;
    lpLockStatus = "Low pool liquidity (< $10k)";
    warnings.push("Low liquidity reserves under $10,000 may incur price impact");
  } else {
    lpLockScore = 5;
    lpLockStatus = "Very thin or unindexed liquidity";
    warnings.push("Extremely thin liquidity pool");
  }

  // 2. Holder Concentration (0 - 25 pts)
  let concentrationScore = 25;
  if (top10Pct <= 15) {
    concentrationScore = 25;
    reasons.push(`Healthy decentralization: Top 10 hold only ${top10Pct.toFixed(1)}%`);
  } else if (top10Pct <= 30) {
    concentrationScore = 20;
    reasons.push(`Moderate concentration: Top 10 hold ${top10Pct.toFixed(1)}% of supply`);
  } else if (top10Pct <= 50) {
    concentrationScore = 12;
    warnings.push(`High whale concentration: Top 10 hold ${top10Pct.toFixed(1)}%`);
  } else {
    concentrationScore = 5;
    warnings.push(`Extreme concentration: Top 10 wallets control ${top10Pct.toFixed(1)}% of tokens`);
  }

  // 3. Contract Privileges & Ownership (0 - 25 pts)
  let privilegeScore = 25;
  let privilegeStatus = "Renounced / immutable supply";

  if (isOwnerRenounced && !hasMintFunction) {
    privilegeScore = 25;
    privilegeStatus = "Ownership renounced · Fixed supply cap";
    reasons.push("Contract ownership renounced or locked with zero mint privileges");
  } else if (isOwnerRenounced && hasMintFunction) {
    privilegeScore = 15;
    privilegeStatus = "Renounced with fixed mint logic";
    warnings.push("Contract retains mint references despite renouncement");
  } else if (!isOwnerRenounced && !hasMintFunction) {
    privilegeScore = 18;
    privilegeStatus = "Active owner · Fixed supply";
    reasons.push("Fixed token supply cap (no arbitrary mint function)");
  } else {
    privilegeScore = 5;
    privilegeStatus = "Owner can mint new tokens";
    warnings.push("Owner retains minting authority to inflate circulating supply");
  }

  // 4. Sell Simulation / Taxes / Honeypot Check (0 - 25 pts)
  let honeypotScore = 25;
  let honeypotStatus = "Clean trade execution (0% fee)";

  if (isHoneypot) {
    honeypotScore = 0;
    honeypotStatus = "CRITICAL: Honeypot detected (cannot sell)";
    warnings.push("CRITICAL ALERT: Token fails sell simulation (honeypot trap)");
  } else if (sellTaxPct > 10 || buyTaxPct > 10) {
    honeypotScore = 5;
    honeypotStatus = `High trading tax (Buy ${buyTaxPct}%, Sell ${sellTaxPct}%)`;
    warnings.push(`High transaction tax: ${sellTaxPct}% sell fee`);
  } else if (sellTaxPct > 2 || buyTaxPct > 2) {
    honeypotScore = 15;
    honeypotStatus = `Low trading tax (${sellTaxPct}% fee)`;
    reasons.push(`Modest ${sellTaxPct}% protocol transaction fee`);
  } else {
    honeypotScore = 25;
    honeypotStatus = "Zero tax · Instant swap execution";
    reasons.push("Zero tax transfer logic passes honeypot simulation");
  }

  if (antiSnipeActive) {
    honeypotScore = Math.max(0, honeypotScore - 5);
    warnings.push("Anti-snipe cooldown currently active for newly minted blocks");
  }

  const rawScore = lpLockScore + concentrationScore + privilegeScore + honeypotScore;
  const score = Math.max(0, Math.min(100, isHoneypot ? Math.min(rawScore, 10) : rawScore));

  let tier: TokenXRayReport["tier"] = "low_risk";
  let tierLabel = "Low Risk";
  if (score < 50 || isHoneypot) {
    tier = "high_risk";
    tierLabel = "High Risk";
  } else if (score < 75) {
    tier = "moderate_risk";
    tierLabel = "Moderate Risk";
  }

  const summary =
    tier === "low_risk"
      ? "Token contract exhibits healthy liquidity, decentralized supply distribution, and verified safe trade logic."
      : tier === "moderate_risk"
        ? "Token is tradeable on Base but exhibits moderate concentration or low liquidity depth."
        : "High risk contract detected. Exercise extreme caution or avoid trading.";

  return {
    address,
    score,
    tier,
    tierLabel,
    summary,
    factors: {
      lpLockScore,
      lpLockStatus,
      concentrationScore,
      top10ConcentrationPct: top10Pct,
      privilegeScore,
      privilegeStatus,
      honeypotScore,
      honeypotStatus,
    },
    reasons,
    warnings,
    timestamp: Date.now(),
  };
}
