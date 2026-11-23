import type { ContractCall } from "@/lib/utils/tx";
import {
  buildAttributedApproveCall,
  buildAttributedMorphoSupplyCollateralCall,
  buildAttributedMorphoBorrowCall,
  buildAttributedMorphoRepayCall,
  buildAttributedMorphoWithdrawCollateralCall,
  buildAttributedVaultDepositCall,
  buildAttributedVaultWithdrawCall,
  buildAttributedBeefyDepositCall,
  buildAttributedBeefyWithdrawCall,
  buildAttributedGaugeDepositCall,
  buildAttributedGaugeWithdrawCall,
  buildAttributedAaveSupplyCall,
  buildAttributedAaveBorrowCall,
  buildAttributedAaveRepayCall,
  buildAttributedAaveWithdrawCall,
} from "./builder-attribution";
import type { StockLendingOption } from "./unified-comparison";
import { AAVE_V4_RESERVES } from "./aave-v4/constants";
import { buildAaveV4BorrowUsdc, buildAaveV4RepayUsdc, buildAaveV4SupplyCollateral, buildAaveV4Withdraw } from "./aave-v4/calls";

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
  approveAmount?: bigint;
  /** Aave V4 only: collateral is already switched on for this stock, so the extra call is skipped. */
  collateralAlreadyOn?: boolean;
}): ContractCall[] {
  const { option, action, amountRaw, userAddress, requiresApproval = true, approveAmount, collateralAlreadyOn = false } = params;
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
      buildAttributedApproveCall(targetToken, option.contractAddress, approveAmount ?? amountRaw)
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

    case "ipor":
    case "pendle": {
      // ERC-4626 standard Plasma Vault / Yield Vault deposit/withdraw
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

    case "beefy": {
      // Beefy Finance Auto-Compounding Vault
      if (action === "supply" || action === "strategy_deposit") {
        calls.push(
          buildAttributedBeefyDepositCall(option.contractAddress, amountRaw)
        );
      } else if (action === "withdraw" || action === "strategy_withdraw") {
        calls.push(
          buildAttributedBeefyWithdrawCall(option.contractAddress, amountRaw)
        );
      }
      break;
    }

    case "aerodrome": {
      // Aerodrome Gauge Staking
      if (action === "supply" || action === "strategy_deposit") {
        calls.push(
          buildAttributedGaugeDepositCall(option.contractAddress, amountRaw)
        );
      } else if (action === "withdraw" || action === "strategy_withdraw") {
        calls.push(
          buildAttributedGaugeWithdrawCall(option.contractAddress, amountRaw)
        );
      }
      break;
    }

    case "aave_v4": {
      // Aave V4 Equities Hub: stocks are collateral, USDC is the loan. The approval (if any) was added above.
      const reserve = Object.values(AAVE_V4_RESERVES).find((r) => r.address.toLowerCase() === option.stockAddress.toLowerCase());
      if (!reserve) throw new Error(`${option.stockSymbol} is not an Aave V4 collateral asset`);
      if (action === "supply") {
        calls.push(
          ...buildAaveV4SupplyCollateral({ token: option.stockAddress, reserveId: reserve.id, amount: amountRaw, user: userAddress, needsApproval: false, collateralAlreadyOn })
        );
      } else if (action === "borrow") {
        calls.push(...buildAaveV4BorrowUsdc({ amount: amountRaw, user: userAddress }));
      } else if (action === "repay") {
        calls.push(...buildAaveV4RepayUsdc({ usdc: option.loanAddress, amount: amountRaw, user: userAddress, needsApproval: false }));
      } else if (action === "withdraw") {
        calls.push(...buildAaveV4Withdraw({ reserveId: reserve.id, amount: amountRaw, user: userAddress }));
      }
      break;
    }

    case "aave": {
      // Aave Pro Equities Collateral Lending Hub on Base
      if (action === "supply") {
        calls.push(
          buildAttributedAaveSupplyCall(option.stockAddress, amountRaw, userAddress)
        );
      } else if (action === "borrow") {
        calls.push(
          buildAttributedAaveBorrowCall(option.loanAddress, amountRaw, userAddress)
        );
      } else if (action === "repay") {
        calls.push(
          buildAttributedAaveRepayCall(option.loanAddress, amountRaw, userAddress)
        );
      } else if (action === "withdraw") {
        calls.push(
          buildAttributedAaveWithdrawCall(option.stockAddress, amountRaw, userAddress)
        );
      }
      break;
    }
  }

  return calls;
}
