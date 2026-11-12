/**
 * Stock-backed loan planner math (pure, no network).
 *
 * Tokenized stocks trade ~24/5 on-chain but the underlying only prices when its market is open,
 * so the price can GAP between sessions (earnings, news, weekends) instead of moving smoothly.
 * These helpers answer: how much can I borrow *conservatively*, what does it cost, where do I get
 * liquidated, what happens in a gap, and how much do I repay/add to recover.
 *
 * All numbers are model outputs from the inputs given — not predictions or advice.
 */

export interface LoanInputs {
  /** USD value of collateral deposited (or to be deposited). */
  collateralUsd: number;
  /** USD value of the stablecoin debt (existing or planned). */
  debtUsd: number;
  /** Protocol liquidation LTV / threshold, percent (e.g. 80). */
  liquidationLtvPct: number;
  /** Current collateral price in USD (per share). */
  priceUsd: number;
  /** Variable borrow APR, percent. */
  borrowAprPct: number | null;
  /** Liquidation penalty paid by borrower, percent of seized collateral value. Default 5. */
  liquidationPenaltyPct?: number;
}

export const DEFAULT_GAP_BUFFER_PCT = 25;
export const DEFAULT_LIQ_PENALTY_PCT = 5;
export const TARGET_RECOVERY_HF = 1.25;

const finite = (n: number) => (Number.isFinite(n) ? n : 0);

/** Health factor = collateral × liquidationLTV / debt. Null when there is no debt. */
export function healthFactor(collateralUsd: number, debtUsd: number, liquidationLtvPct: number): number | null {
  if (debtUsd <= 0) return null;
  return (collateralUsd * (liquidationLtvPct / 100)) / debtUsd;
}

export function currentLtvPct(collateralUsd: number, debtUsd: number): number {
  if (collateralUsd <= 0) return debtUsd > 0 ? 100 : 0;
  return (debtUsd / collateralUsd) * 100;
}

/**
 * Conservative borrow limit: the most you can owe and still survive an overnight gap of
 * `gapBufferPct` without reaching liquidation. Always <= the protocol's own max.
 */
export function conservativeBorrowLimitUsd(
  collateralUsd: number,
  liquidationLtvPct: number,
  gapBufferPct = DEFAULT_GAP_BUFFER_PCT
): number {
  const g = Math.min(Math.max(gapBufferPct, 0), 99) / 100;
  return finite(collateralUsd * (1 - g) * (liquidationLtvPct / 100));
}

/** Protocol-theoretical ceiling (HF = 1). Never recommend borrowing this. */
export function protocolBorrowCeilingUsd(collateralUsd: number, liquidationLtvPct: number): number {
  return finite(collateralUsd * (liquidationLtvPct / 100));
}

/** Collateral price at which HF hits 1.0 (liquidation begins). Null when no debt. */
export function liquidationPriceUsd(i: Pick<LoanInputs, "collateralUsd" | "debtUsd" | "liquidationLtvPct" | "priceUsd">): number | null {
  if (i.debtUsd <= 0 || i.collateralUsd <= 0) return null;
  return i.priceUsd * (i.debtUsd / (i.collateralUsd * (i.liquidationLtvPct / 100)));
}

export interface BorrowCost {
  perDayUsd: number;
  perMonthUsd: number;
  perYearUsd: number;
  /** True when the rate was missing, so costs are unknown (not zero). */
  unknown: boolean;
}

export function borrowCost(debtUsd: number, aprPct: number | null): BorrowCost {
  if (aprPct === null || !Number.isFinite(aprPct)) {
    return { perDayUsd: 0, perMonthUsd: 0, perYearUsd: 0, unknown: true };
  }
  const yearly = debtUsd * (aprPct / 100);
  return { perDayUsd: yearly / 365, perMonthUsd: yearly / 12, perYearUsd: yearly, unknown: false };
}

export type StressOutcome = "safe" | "tight" | "liquidatable" | "underwater";

export interface StressScenario {
  id: string;
  label: string;
  description: string;
  dropPct: number;
  /** Price after the move. */
  priceUsd: number;
  collateralUsd: number;
  healthFactor: number | null;
  ltvPct: number;
  outcome: StressOutcome;
  /** Debt not covered by collateral (bad debt) — 0 unless underwater. */
  shortfallUsd: number;
  /** Rough collateral value lost to penalty if liquidated (model estimate). */
  penaltyLossUsd: number;
  /** Repay needed to restore TARGET_RECOVERY_HF at this price (0 if already above). */
  repayToRecoverUsd: number;
  /** Alternatively: extra collateral (USD at new price) needed to restore TARGET_RECOVERY_HF. */
  addCollateralToRecoverUsd: number;
}

export const STRESS_PRESETS: ReadonlyArray<{ id: string; label: string; description: string; dropPct: number }> = [
  { id: "dip", label: "Normal dip", description: "A rough week for the stock.", dropPct: 10 },
  { id: "gap", label: "Overnight gap", description: "Bad news after the close; price reopens lower.", dropPct: 20 },
  { id: "earnings", label: "Earnings gap", description: "Large earnings-day move against you.", dropPct: 35 },
  { id: "crash", label: "Severe gap", description: "Extreme single-session gap (rare, but it happens).", dropPct: 50 },
];

export function runStress(i: LoanInputs, dropPct: number, meta?: { id: string; label: string; description: string }): StressScenario {
  const drop = Math.min(Math.max(dropPct, 0), 100);
  const penalty = (i.liquidationPenaltyPct ?? DEFAULT_LIQ_PENALTY_PCT) / 100;
  const priceUsd = i.priceUsd * (1 - drop / 100);
  const collateralUsd = i.collateralUsd * (1 - drop / 100);
  const hf = healthFactor(collateralUsd, i.debtUsd, i.liquidationLtvPct);
  const ltv = currentLtvPct(collateralUsd, i.debtUsd);

  let outcome: StressOutcome = "safe";
  if (hf !== null) {
    if (collateralUsd < i.debtUsd) outcome = "underwater";
    // HF == 1.0 is the liquidation point itself — treat it as liquidatable, not "tight".
    else if (hf <= 1 + 1e-9) outcome = "liquidatable";
    else if (hf < TARGET_RECOVERY_HF) outcome = "tight";
  }

  const shortfallUsd = Math.max(0, i.debtUsd - collateralUsd);
  const penaltyLossUsd = outcome === "liquidatable" || outcome === "underwater" ? Math.min(collateralUsd, i.debtUsd) * penalty : 0;

  const lltv = i.liquidationLtvPct / 100;
  const maxDebtAtTarget = (collateralUsd * lltv) / TARGET_RECOVERY_HF;
  const repayToRecoverUsd = Math.max(0, i.debtUsd - maxDebtAtTarget);
  const collateralNeeded = (TARGET_RECOVERY_HF * i.debtUsd) / lltv;
  const addCollateralToRecoverUsd = Math.max(0, collateralNeeded - collateralUsd);

  return {
    id: meta?.id ?? `drop-${drop}`,
    label: meta?.label ?? `-${drop}%`,
    description: meta?.description ?? "Custom price move.",
    dropPct: drop,
    priceUsd,
    collateralUsd,
    healthFactor: hf,
    ltvPct: ltv,
    outcome,
    shortfallUsd,
    penaltyLossUsd,
    repayToRecoverUsd,
    addCollateralToRecoverUsd,
  };
}

export function runStressSuite(i: LoanInputs): StressScenario[] {
  return STRESS_PRESETS.map((p) => runStress(i, p.dropPct, p));
}

/** Largest single drop (%) survived before liquidation begins. 100 when no debt. */
export function maxSurvivableDropPct(i: Pick<LoanInputs, "collateralUsd" | "debtUsd" | "liquidationLtvPct">): number {
  const hf = healthFactor(i.collateralUsd, i.debtUsd, i.liquidationLtvPct);
  if (hf === null) return 100;
  if (hf <= 1) return 0;
  return (1 - 1 / hf) * 100;
}

export type RiskTier = "conservative" | "moderate" | "aggressive" | "danger" | "none";

/** Tier by whether the position survives the preset gaps. */
export function riskTier(i: LoanInputs): RiskTier {
  if (i.debtUsd <= 0) return "none";
  const survives = (d: number) => {
    const s = runStress(i, d);
    return s.outcome === "safe" || s.outcome === "tight";
  };
  if (!survives(10)) return "danger";
  if (!survives(20)) return "aggressive";
  if (!survives(35)) return "moderate";
  return "conservative";
}

export interface RepayOption {
  id: "partial" | "recover" | "full";
  label: string;
  repayUsd: number;
  resultingHealthFactor: number | null;
  note: string;
}

/** What you can do about it: pay down some, pay down to a safe HF, or close out. */
export function repayOptions(i: LoanInputs): RepayOption[] {
  if (i.debtUsd <= 0) return [];
  const lltv = i.liquidationLtvPct / 100;
  const toTarget = Math.max(0, i.debtUsd - (i.collateralUsd * lltv) / TARGET_RECOVERY_HF);
  const half = i.debtUsd / 2;
  const hfAfter = (repay: number) => healthFactor(i.collateralUsd, Math.max(0, i.debtUsd - repay), i.liquidationLtvPct);
  return [
    { id: "partial", label: "Repay half", repayUsd: half, resultingHealthFactor: hfAfter(half), note: "Halves your interest cost and lifts your safety margin." },
    {
      id: "recover",
      label: `Reach HF ${TARGET_RECOVERY_HF}`,
      repayUsd: toTarget,
      resultingHealthFactor: hfAfter(toTarget),
      note: toTarget === 0 ? "Already above this level." : "Smallest repayment that restores a comfortable buffer.",
    },
    { id: "full", label: "Repay in full", repayUsd: i.debtUsd, resultingHealthFactor: null, note: "Debt-free; you can withdraw all collateral." },
  ];
}

export interface LoanWarning {
  id: string;
  severity: "info" | "warn" | "critical";
  text: string;
}

/** Plain-language caveats surfaced next to the numbers. */
export function loanWarnings(
  i: LoanInputs,
  ctx: { marketOpen: boolean; oraclePaused?: boolean; rateIsEstimate?: boolean; availableLiquidityUsd?: number }
): LoanWarning[] {
  const w: LoanWarning[] = [];
  const hf = healthFactor(i.collateralUsd, i.debtUsd, i.liquidationLtvPct);
  if (hf !== null && hf < 1.0)
    w.push({ id: "liq", severity: "critical", text: "This position is already at or past the liquidation threshold." });
  else if (hf !== null && hf < TARGET_RECOVERY_HF)
    w.push({ id: "thin", severity: "warn", text: "Thin safety margin: a normal-sized stock move could trigger liquidation." });

  if (ctx.oraclePaused)
    w.push({
      id: "oracle",
      severity: "critical",
      text: "The price feed for this market is paused. New borrows may be blocked, and when it resumes the price can jump straight to the new level.",
    });
  if (!ctx.marketOpen)
    w.push({
      id: "closed",
      severity: "warn",
      text: "The stock's home market is closed. The on-chain price may be stale until it reopens, then can gap in one step — and you may not be able to add collateral or exit at a good price in the meantime.",
    });
  w.push({
    id: "transfers",
    severity: "info",
    text: "Tokenized stock transfers can be paused or restricted by the issuer or by region rules. If that happens you may be unable to add collateral or withdraw — repaying with stablecoins is the lever that always works.",
  });
  if (ctx.rateIsEstimate)
    w.push({ id: "rate", severity: "info", text: "Borrow rate shown is an estimate and is variable. Confirm the live rate in the protocol before borrowing." });
  if (ctx.availableLiquidityUsd !== undefined && ctx.availableLiquidityUsd > 0 && i.debtUsd > ctx.availableLiquidityUsd)
    w.push({ id: "liquidity", severity: "warn", text: "Your planned loan is larger than the pool's currently available liquidity." });
  w.push({ id: "debt", severity: "info", text: "Borrowing avoids selling but adds debt, interest, and liquidation risk. Not financial advice." });
  return w;
}
