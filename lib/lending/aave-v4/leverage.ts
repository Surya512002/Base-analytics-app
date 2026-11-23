import { encodeFunctionData } from "viem";
import { buildContractCall, type ContractCall } from "@/lib/utils/tx";
import { buildAttributedApproveCall } from "@/lib/lending/builder-attribution";
import { SWAP_ROUTER_02, encodeExactInputSingle } from "@/lib/launchpad/uniswap";
import { AAVE_V4_RESERVES, AAVE_V4_SPOKE, AAVE_V4_SPOKE_ABI, AAVE_V4_USDC_RESERVE_ID } from "./constants";
import { buildAaveV4SupplyCollateral } from "./calls";
import { SAFE_HEALTH_FACTOR, healthFactor, liquidationPrice, maxBorrowUsd } from "./math";

/**
 * Leverage on a stock using the Aave V4 Equities Hub, as one batch: add your stock as collateral, then repeat
 * [borrow USDC, buy the stock with it, supply it as more collateral] until the target is reached.
 *
 * Why it is built this way
 *  - No custom contract and no flash loan: only the audited Aave spoke and Uniswap's router are called.
 *  - Every borrow is sized so the health factor stays at SAFE_HEALTH_FACTOR (1.5) or better, even counting only
 *    the guaranteed minimum of stock each swap returns.
 *  - The stock pools on Base are thin, so the plan is priced from a real quote for the whole amount, and refused
 *    when buying would cost more than MAX_BUY_PREMIUM_PCT above the oracle price.
 *  - The batch must run atomically: if any step fails, nothing happens.
 */

export const MAX_LOOPS = 4;
/** Refuse a plan if the stock costs more than this many percent above the oracle price at the planned size. */
export const MAX_BUY_PREMIUM_PCT = 2;
/** Room added on top of the quoted price for the minimum accepted from each swap. */
export const LEVERAGE_SLIPPAGE_BPS = 100;
export const MIN_STEP_USD = 1;

export type LeverageInput = {
  priceUsd: number; // oracle price of the stock
  collateralFactor: number; // percent
  startTokens: number; // stock tokens the user adds first
  existingPower: number; // USD borrow power already in the account (other stocks)
  existingDebt: number; // USDC already borrowed
  targetLeverage: number; // total stock value / starting stock value (1.5 = a 50% bigger position)
  /** Worst-case USD paid per stock token across all the swaps (quote for the whole amount plus slippage). */
  buyPriceUsd: number;
  safeHf?: number;
  maxLoops?: number;
};

export type LeverageStep = { borrowUsd: number; minTokens: number };

export type LeveragePlan = {
  steps: LeverageStep[];
  totalBorrowUsd: number;
  /** Guaranteed minimum of stock bought. */
  minTokensBought: number;
  /** Stock position after the plan, USD at the oracle price, using the guaranteed minimum. */
  collateralUsd: number;
  debtUsd: number;
  healthFactor: number | null;
  /** Leverage actually reached (can be lower than asked: the safe limit or the loop limit came first). */
  leverageReached: number;
  /** What buying costs over the oracle value, USD, worst case. */
  buyCostUsd: number;
  buyPremiumPct: number;
  liquidationPrice: number | null;
  dropToLiquidationPct: number | null;
  limitedBy: "target" | "safe-health" | "loops";
};

export function planLeverage(i: LeverageInput): LeveragePlan {
  const safeHf = i.safeHf ?? SAFE_HEALTH_FACTOR;
  const maxLoops = i.maxLoops ?? MAX_LOOPS;
  const startUsd = i.startTokens * i.priceUsd;
  let power = i.existingPower + (startUsd * i.collateralFactor) / 100;
  let debt = i.existingDebt;
  let remaining = Math.max(0, (i.targetLeverage - 1) * startUsd);
  const steps: LeverageStep[] = [];
  let boughtUsd = 0;
  let boughtTokens = 0;
  let limitedBy: LeveragePlan["limitedBy"] = "target";

  if (startUsd > 0 && i.buyPriceUsd > 0) {
    while (remaining > MIN_STEP_USD / 10 && steps.length < maxLoops) {
      const cap = maxBorrowUsd(power, debt, safeHf);
      const borrow = Math.min(remaining, cap);
      if (borrow < MIN_STEP_USD) {
        limitedBy = "safe-health";
        break;
      }
      const minTokens = borrow / i.buyPriceUsd;
      steps.push({ borrowUsd: borrow, minTokens });
      debt += borrow;
      power += (minTokens * i.priceUsd * i.collateralFactor) / 100;
      boughtUsd += minTokens * i.priceUsd;
      boughtTokens += minTokens;
      remaining -= borrow;
    }
    if (remaining > MIN_STEP_USD && steps.length >= maxLoops && limitedBy === "target") limitedBy = "loops";
  }

  const totalBorrowUsd = steps.reduce((a, s) => a + s.borrowUsd, 0);
  const collateralUsd = startUsd + boughtUsd;
  const thisPower = (collateralUsd * i.collateralFactor) / 100;
  const liq = liquidationPrice(i.priceUsd, power, debt, thisPower);
  return {
    steps,
    totalBorrowUsd,
    minTokensBought: boughtTokens,
    collateralUsd,
    debtUsd: debt,
    healthFactor: healthFactor(power, debt),
    leverageReached: startUsd > 0 ? collateralUsd / startUsd : 1,
    buyCostUsd: totalBorrowUsd - boughtUsd,
    buyPremiumPct: totalBorrowUsd > 0 ? ((totalBorrowUsd - boughtUsd) / totalBorrowUsd) * 100 : 0,
    liquidationPrice: liq,
    dropToLiquidationPct: liq != null ? (1 - liq / i.priceUsd) * 100 : null,
    limitedBy,
  };
}

/** The most leverage the safe-health rule allows from this start (before the swap cost is known). */
export function maxLeverageFor(i: Omit<LeverageInput, "targetLeverage">): number {
  return planLeverage({ ...i, targetLeverage: 50 }).leverageReached;
}

/** True when buying costs more than the allowed premium over the oracle price. */
export function premiumTooHigh(quotedUsdPerToken: number, oraclePriceUsd: number): boolean {
  return oraclePriceUsd > 0 && (quotedUsdPerToken / oraclePriceUsd - 1) * 100 > MAX_BUY_PREMIUM_PCT;
}

export type LeverageCallParams = {
  user: `0x${string}`;
  stock: { address: `0x${string}`; reserveId: bigint };
  startRaw: bigint;
  startNeedsApproval: boolean;
  collateralAlreadyOn: boolean;
  steps: Array<{ borrowRaw: bigint; minOutRaw: bigint }>;
  uniswapFee: number;
};

const USDC = AAVE_V4_RESERVES.USDC.address as `0x${string}`;

/** The whole leverage batch. Approvals are exact; every call carries the builder code. */
export function buildLeverageCalls(p: LeverageCallParams): ContractCall[] {
  if (p.steps.length === 0 || p.steps.length > MAX_LOOPS) throw new Error("Invalid number of leverage steps");
  const calls: ContractCall[] = [];
  if (p.startRaw > BigInt(0)) {
    calls.push(
      ...buildAaveV4SupplyCollateral({ token: p.stock.address, reserveId: p.stock.reserveId, amount: p.startRaw, user: p.user, needsApproval: p.startNeedsApproval, collateralAlreadyOn: p.collateralAlreadyOn })
    );
  }
  for (const s of p.steps) {
    if (s.borrowRaw <= BigInt(0) || s.minOutRaw <= BigInt(0)) throw new Error("Each step needs a borrow amount and a minimum output");
    calls.push(
      buildContractCall(AAVE_V4_SPOKE, encodeFunctionData({ abi: AAVE_V4_SPOKE_ABI, functionName: "borrow", args: [AAVE_V4_USDC_RESERVE_ID, s.borrowRaw, p.user] })),
      buildAttributedApproveCall(USDC, SWAP_ROUTER_02, s.borrowRaw),
      buildContractCall(SWAP_ROUTER_02, encodeExactInputSingle({ tokenIn: USDC, tokenOut: p.stock.address, recipient: p.user, amountIn: s.borrowRaw, amountOutMinimum: s.minOutRaw, fee: p.uniswapFee })),
      buildAttributedApproveCall(p.stock.address, AAVE_V4_SPOKE, s.minOutRaw),
      buildContractCall(AAVE_V4_SPOKE, encodeFunctionData({ abi: AAVE_V4_SPOKE_ABI, functionName: "supply", args: [p.stock.reserveId, s.minOutRaw, p.user] }))
    );
  }
  return calls;
}
