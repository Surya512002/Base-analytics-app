/**
 * Launch Readiness Simulator & Pre-Flight Scoring
 * Calculates 0-100 Launch Score across 4 pillars:
 * 1. Initial Liquidity Depth (0-25 pts)
 * 2. LP Lock Duration (0-25 pts)
 * 3. Anti-Snipe Block Protection (0-25 pts)
 * 4. Tokenomics & Pool Reserve Decentralization (0-25 pts)
 */

export interface PreFlightCheckItem {
  name: string;
  passed: boolean;
  score: number;
  maxScore: number;
  message: string;
}

export interface LaunchReadinessReport {
  score: number; // 0 to 100
  grade: "A+" | "B" | "C" | "Needs Review";
  tierLabel: string;
  summary: string;
  checks: PreFlightCheckItem[];
  recommendations: string[];
}

export interface LaunchSimulatorParams {
  poolReservePct: number;
  creatorPct: number;
  insiderTotalPct?: number;
  vestedTotalPct?: number;
  autoSeedLiquidity: boolean;
  seedLiquidityEth: string;
  liquidityLocked: boolean;
  lockDurationDays: number;
  antiSnipeBlocks?: number;
}

export function computeLaunchReadiness(params: LaunchSimulatorParams): LaunchReadinessReport {
  const {
    poolReservePct,
    creatorPct: _creatorPct,
    autoSeedLiquidity,
    seedLiquidityEth,
    liquidityLocked,
    lockDurationDays,
    antiSnipeBlocks = 8,
  } = params;

  const checks: PreFlightCheckItem[] = [];
  const recommendations: string[] = [];

  // Pillar 1: Initial Liquidity Depth (0-25)
  const ethNum = parseFloat(seedLiquidityEth || "0");
  let liquidityScore = 0;
  let liquidityMessage = "";

  if (autoSeedLiquidity && ethNum >= 0.5) {
    liquidityScore = 25;
    liquidityMessage = `Deep initial pool: ${ethNum} ETH seeded automatically`;
  } else if (autoSeedLiquidity && ethNum >= 0.1) {
    liquidityScore = 20;
    liquidityMessage = `Adequate initial pool: ${ethNum} ETH`;
  } else if (autoSeedLiquidity && ethNum > 0) {
    liquidityScore = 12;
    liquidityMessage = `Low initial liquidity: ${ethNum} ETH may incur high price impact`;
    recommendations.push("Increase initial liquidity to >= 0.1 ETH to reduce price impact for first buyers.");
  } else {
    liquidityScore = 0;
    liquidityMessage = "No automated initial liquidity configured";
    recommendations.push("Enable automated liquidity seeding to establish immediate DEX trading.");
  }
  checks.push({
    name: "Initial Liquidity",
    passed: liquidityScore >= 20,
    score: liquidityScore,
    maxScore: 25,
    message: liquidityMessage,
  });

  // Pillar 2: LP Lock Duration (0-25)
  let lockScore = 0;
  let lockMessage = "";

  if (liquidityLocked && lockDurationDays >= 365) {
    lockScore = 25;
    lockMessage = `1 Year (${lockDurationDays}d) LP Lock - Highest security tier`;
  } else if (liquidityLocked && lockDurationDays >= 180) {
    lockScore = 20;
    lockMessage = `${lockDurationDays} Days LP Lock`;
  } else if (liquidityLocked && lockDurationDays >= 30) {
    lockScore = 12;
    lockMessage = `Short ${lockDurationDays} Days LP Lock`;
    recommendations.push("Consider extending LP lock duration to >= 180 days to increase community confidence.");
  } else {
    lockScore = 0;
    lockMessage = "Liquidity is unlocked (High rug-pull risk for buyers)";
    recommendations.push("Lock liquidity for at least 90-365 days to eliminate rug risk.");
  }
  checks.push({
    name: "LP Lock Duration",
    passed: lockScore >= 20,
    score: lockScore,
    maxScore: 25,
    message: lockMessage,
  });

  // Pillar 3: Anti-Snipe Protection (0-25)
  let antiSnipeScore = 0;
  let antiSnipeMessage = "";

  if (antiSnipeBlocks >= 8) {
    antiSnipeScore = 25;
    antiSnipeMessage = `${antiSnipeBlocks} block delay prevents MEV frontrunning bots`;
  } else if (antiSnipeBlocks >= 1) {
    antiSnipeScore = 15;
    antiSnipeMessage = `${antiSnipeBlocks} block delay provides partial bot mitigation`;
    recommendations.push("Increase anti-snipe block delay to 8+ blocks for optimal frontrun defense.");
  } else {
    antiSnipeScore = 5;
    antiSnipeMessage = "Anti-snipe disabled — bots may snipe first block liquidity";
    recommendations.push("Enable anti-snipe delay to prevent MEV sandwich bots at block 0.");
  }
  checks.push({
    name: "Anti-Snipe Defense",
    passed: antiSnipeScore >= 20,
    score: antiSnipeScore,
    maxScore: 25,
    message: antiSnipeMessage,
  });

  // Pillar 4: Supply Distribution (0-25)
  let distributionScore = 0;
  let distributionMessage = "";

  if (poolReservePct >= 70) {
    distributionScore = 25;
    distributionMessage = `High decentralization: ${poolReservePct}% allocated to public liquidity`;
  } else if (poolReservePct >= 50) {
    distributionScore = 18;
    distributionMessage = `Moderate decentralization: ${poolReservePct}% in public pool`;
  } else {
    distributionScore = 8;
    distributionMessage = `High insider concentration: Only ${poolReservePct}% in public liquidity`;
    recommendations.push("Increase public liquidity reserve to >= 60% to avoid heavy holder concentration.");
  }
  checks.push({
    name: "Tokenomics Decentralization",
    passed: distributionScore >= 20,
    score: distributionScore,
    maxScore: 25,
    message: distributionMessage,
  });

  const totalScore = liquidityScore + lockScore + antiSnipeScore + distributionScore;

  let grade: LaunchReadinessReport["grade"] = "Needs Review";
  let tierLabel = "Caution";
  let summary = "";

  if (totalScore >= 85) {
    grade = "A+";
    tierLabel = "Optimal Launch Readiness";
    summary = "Launch configuration meets top institutional and security standards on Base.";
  } else if (totalScore >= 65) {
    grade = "B";
    tierLabel = "Good Readiness";
    summary = "Solid launch parameters, with minor opportunities to enhance LP lock or depth.";
  } else {
    grade = "C";
    tierLabel = "High Risk / Needs Review";
    summary = "Configuration contains high-risk factors (unlocked LP, thin liquidity, or high concentration).";
  }

  return {
    score: totalScore,
    grade,
    tierLabel,
    summary,
    checks,
    recommendations,
  };
}
