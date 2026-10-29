import { encodeFunctionData, type Hex, parseAbi } from "viem";
import { BUILDER_CODE } from "@/lib/constants/env";
import { buildContractCall, type ContractCall } from "@/lib/utils/tx";
import {
  buildAttributedApproveCall,
  buildAttributedMorphoSupplyCollateralCall,
  buildAttributedMorphoBorrowCall,
  buildAttributedMorphoRepayCall,
  buildAttributedMorphoSupplyCall,
  buildAttributedMorphoWithdrawCollateralCall,
  buildAttributedVaultDepositCall,
  buildAttributedVaultWithdrawCall,
} from "./builder-attribution";
import type { StockLendingOption } from "./unified-comparison";

const MOONWELL_MTOKEN_ABI = parseAbi([
  "function mint(uint256 mintAmount) external returns (uint256)",
  "function redeem(uint256 redeemTokens) external returns (uint256)",
  "function redeemUnderlying(uint256 redeemAmount) external returns (uint256)",
  "function borrow(uint256 borrowAmount) external returns (uint256)",
  "function repayBorrow(uint256 repayAmount) external returns (uint256)",
]);

/**
 * Build 1-click execution calls for any protocol in the Unified Stock Lending Comparison.
 * Automatically prepares approval call if needed, followed by protocol deposit/borrow/repay.
 */
export function buildUnifiedProtocolCalls(params: {
  option: StockLendingOption;
  action: "supply" | "borrow" | "repay" | "withdraw" | "strategy_deposit" | "strategy_withdraw";
  amountRaw: bigint;
  userAddress: `0x${string}`;
  requiresApproval?: boolean;
}): ContractCall[] {
  const { option, action, amountRaw, userAddress, requiresApproval = true } = params;
  const calls: ContractCall[] = [];

  // Determine active token for approval & action
  const targetToken =
    action === "repay"
      ? option.loanAddress // USDC
      : action === "borrow"
        ? option.loanAddress // USDC
        : option.stockAddress; // Stock token

  // 1. Approval Call if required
  if (
    requiresApproval &&
    (action === "supply" || action === "repay" || action === "strategy_deposit")
  ) {
    calls.push(
      buildAttributedApproveCall(targetToken, option.contractAddress, amountRaw)
    );
  }

  // 2. Protocol Action Call
  switch (option.executionType) {
    case "morpho_blue": {
      if (!option.morphoParams) {
        throw new Error("Missing Morpho Blue market parameters");
      }
      if (action === "supply") {
        calls.push(
          buildAttributedMorphoSupplyCollateralCall(
            option.morphoParams,
            amountRaw,
            userAddress
          )
        );
      } else if (action === "borrow") {
        calls.push(
          buildAttributedMorphoBorrowCall(
            option.morphoParams,
            amountRaw,
            userAddress,
            userAddress
          )
        );
      } else if (action === "repay") {
        calls.push(
          buildAttributedMorphoRepayCall(
            option.morphoParams,
            amountRaw,
            userAddress
          )
        );
      } else if (action === "withdraw") {
        calls.push(
          buildAttributedMorphoWithdrawCollateralCall(
            option.morphoParams,
            amountRaw,
            userAddress,
            userAddress
          )
        );
      }
      break;
    }

    case "aerodrome":
    case "beefy":
    case "pendle": {
      // Vault/Strategy deposit/withdraw
      if (action === "supply" || action === "strategy_deposit") {
        calls.push(
          buildAttributedVaultDepositCall(option.contractAddress, amountRaw, userAddress)
        );
      } else if (action === "withdraw" || action === "strategy_withdraw") {
        calls.push(
          buildAttributedVaultWithdrawCall(
            option.contractAddress,
            amountRaw,
            userAddress,
            userAddress
          )
        );
      }
      break;
    }
  }

  return calls;
}
