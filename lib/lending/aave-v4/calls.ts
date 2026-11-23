import { encodeFunctionData } from "viem";
import { buildContractCall, type ContractCall } from "@/lib/utils/tx";
import { buildAttributedApproveCall } from "@/lib/lending/builder-attribution";
import { AAVE_V4_SPOKE, AAVE_V4_SPOKE_ABI, AAVE_V4_USDC_RESERVE_ID } from "./constants";

type Addr = `0x${string}`;

/**
 * Transaction builders for the Aave V4 Equities Hub. Every call goes through buildContractCall, so it
 * carries the builder code like every other call in the app, and every call names the user's own address
 * as `onBehalfOf` so it can only ever act on their own position.
 */
const spoke = (functionName: "supply" | "withdraw" | "borrow" | "repay", reserveId: bigint, amount: bigint, user: Addr): ContractCall =>
  buildContractCall(AAVE_V4_SPOKE, encodeFunctionData({ abi: AAVE_V4_SPOKE_ABI, functionName, args: [reserveId, amount, user] }));

function requirePositive(amount: bigint) {
  if (amount <= BigInt(0)) throw new Error("Enter an amount above zero");
}

/** Supply a stock as collateral: exact approval to the spoke, supply, then switch collateral on if it is not yet. */
export function buildAaveV4SupplyCollateral(p: {
  token: Addr;
  reserveId: bigint;
  amount: bigint;
  user: Addr;
  needsApproval: boolean;
  collateralAlreadyOn: boolean;
}): ContractCall[] {
  requirePositive(p.amount);
  const calls: ContractCall[] = [];
  if (p.needsApproval) calls.push(buildAttributedApproveCall(p.token, AAVE_V4_SPOKE, p.amount));
  calls.push(spoke("supply", p.reserveId, p.amount, p.user));
  if (!p.collateralAlreadyOn) {
    calls.push(
      buildContractCall(
        AAVE_V4_SPOKE,
        encodeFunctionData({ abi: AAVE_V4_SPOKE_ABI, functionName: "setUsingAsCollateral", args: [p.reserveId, true, p.user] })
      )
    );
  }
  return calls;
}

export function buildAaveV4Withdraw(p: { reserveId: bigint; amount: bigint; user: Addr }): ContractCall[] {
  requirePositive(p.amount);
  return [spoke("withdraw", p.reserveId, p.amount, p.user)];
}

/** Borrow USDC (the only borrowable asset). */
export function buildAaveV4BorrowUsdc(p: { amount: bigint; user: Addr }): ContractCall[] {
  requirePositive(p.amount);
  return [spoke("borrow", AAVE_V4_USDC_RESERVE_ID, p.amount, p.user)];
}

/** Repay USDC. Pass the exact amount; the spoke caps it at the debt. */
export function buildAaveV4RepayUsdc(p: { usdc: Addr; amount: bigint; user: Addr; needsApproval: boolean }): ContractCall[] {
  requirePositive(p.amount);
  const calls: ContractCall[] = [];
  if (p.needsApproval) calls.push(buildAttributedApproveCall(p.usdc, AAVE_V4_SPOKE, p.amount));
  calls.push(spoke("repay", AAVE_V4_USDC_RESERVE_ID, p.amount, p.user));
  return calls;
}
