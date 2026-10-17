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

const MORPHO_MIDNIGHT_ABI = parseAbi([
  "function supplyTerm(address asset, uint256 amount, uint256 termDays, address onBehalf) external returns (uint256)",
  "function borrowFixed(address collateralAsset, address loanAsset, uint256 collateralAmount, uint256 borrowAmount, uint256 termDays, address receiver) external returns (uint256)",
  "function repayFixed(address loanAsset, uint256 termId, uint256 amount) external",
]);

const AAVE_V4_EQUITIES_ABI = parseAbi([
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external",
  "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external",
  "function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) external returns (uint256)",
  "function withdraw(address asset, uint256 amount, address to) external returns (uint256)",
]);

const EULER_V2_ABI = parseAbi([
  "function deposit(uint256 assets, address receiver) external returns (uint256)",
  "function borrow(uint256 assets, address receiver) external returns (uint256)",
  "function repay(uint256 assets, address receiver) external returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) external returns (uint256)",
]);

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
      : action === "borrow" && option.executionType !== "morpho_midnight"
        ? option.loanAddress // USDC
        : option.stockAddress; // Stock token

  // 1. Approval Call if required
  if (
    requiresApproval &&
    (action === "supply" ||
      action === "repay" ||
      action === "strategy_deposit" ||
      (action === "borrow" && option.executionType === "morpho_midnight"))
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

    case "morpho_midnight": {
      const termDays = BigInt(option.fixedTermDays ?? 60);
      if (action === "supply") {
        const data = encodeFunctionData({
          abi: MORPHO_MIDNIGHT_ABI,
          functionName: "supplyTerm",
          args: [option.stockAddress, amountRaw, termDays, userAddress],
        });
        calls.push(buildContractCall(option.contractAddress, data));
      } else if (action === "borrow") {
        // Collateral deposit + borrow in fixed term
        const data = encodeFunctionData({
          abi: MORPHO_MIDNIGHT_ABI,
          functionName: "borrowFixed",
          args: [
            option.stockAddress,
            option.loanAddress,
            amountRaw, // Collateral to post
            (amountRaw * BigInt(70)) / BigInt(100), // Nominal borrow at LTV
            termDays,
            userAddress,
          ],
        });
        calls.push(buildContractCall(option.contractAddress, data));
      } else if (action === "repay") {
        const data = encodeFunctionData({
          abi: MORPHO_MIDNIGHT_ABI,
          functionName: "repayFixed",
          args: [option.loanAddress, BigInt(0), amountRaw],
        });
        calls.push(buildContractCall(option.contractAddress, data));
      } else if (action === "withdraw") {
        const data = encodeFunctionData({
          abi: MORPHO_MIDNIGHT_ABI,
          functionName: "repayFixed",
          args: [option.stockAddress, BigInt(0), amountRaw],
        });
        calls.push(buildContractCall(option.contractAddress, data));
      }
      break;
    }

    case "aave_v4": {
      if (action === "supply") {
        const data = encodeFunctionData({
          abi: AAVE_V4_EQUITIES_ABI,
          functionName: "supply",
          args: [option.stockAddress, amountRaw, userAddress, 0],
        });
        calls.push(buildContractCall(option.contractAddress, data));
      } else if (action === "borrow") {
        const data = encodeFunctionData({
          abi: AAVE_V4_EQUITIES_ABI,
          functionName: "borrow",
          args: [option.loanAddress, amountRaw, BigInt(2), 0, userAddress],
        });
        calls.push(buildContractCall(option.contractAddress, data));
      } else if (action === "repay") {
        const data = encodeFunctionData({
          abi: AAVE_V4_EQUITIES_ABI,
          functionName: "repay",
          args: [option.loanAddress, amountRaw, BigInt(2), userAddress],
        });
        calls.push(buildContractCall(option.contractAddress, data));
      } else if (action === "withdraw") {
        const data = encodeFunctionData({
          abi: AAVE_V4_EQUITIES_ABI,
          functionName: "withdraw",
          args: [option.stockAddress, amountRaw, userAddress],
        });
        calls.push(buildContractCall(option.contractAddress, data));
      }
      break;
    }

    case "euler": {
      if (action === "supply") {
        const data = encodeFunctionData({
          abi: EULER_V2_ABI,
          functionName: "deposit",
          args: [amountRaw, userAddress],
        });
        calls.push(buildContractCall(option.contractAddress, data));
      } else if (action === "borrow") {
        const data = encodeFunctionData({
          abi: EULER_V2_ABI,
          functionName: "borrow",
          args: [amountRaw, userAddress],
        });
        calls.push(buildContractCall(option.contractAddress, data));
      } else if (action === "repay") {
        const data = encodeFunctionData({
          abi: EULER_V2_ABI,
          functionName: "repay",
          args: [amountRaw, userAddress],
        });
        calls.push(buildContractCall(option.contractAddress, data));
      } else if (action === "withdraw") {
        const data = encodeFunctionData({
          abi: EULER_V2_ABI,
          functionName: "withdraw",
          args: [amountRaw, userAddress, userAddress],
        });
        calls.push(buildContractCall(option.contractAddress, data));
      }
      break;
    }

    case "superform": {
      // SuperStocks automated carry strategy vault deposit/withdraw
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

    case "moonwell": {
      if (action === "supply") {
        const data = encodeFunctionData({
          abi: MOONWELL_MTOKEN_ABI,
          functionName: "mint",
          args: [amountRaw],
        });
        calls.push(buildContractCall(option.contractAddress, data));
      } else if (action === "borrow") {
        const data = encodeFunctionData({
          abi: MOONWELL_MTOKEN_ABI,
          functionName: "borrow",
          args: [amountRaw],
        });
        calls.push(buildContractCall(option.contractAddress, data));
      } else if (action === "repay") {
        const data = encodeFunctionData({
          abi: MOONWELL_MTOKEN_ABI,
          functionName: "repayBorrow",
          args: [amountRaw],
        });
        calls.push(buildContractCall(option.contractAddress, data));
      } else if (action === "withdraw") {
        const data = encodeFunctionData({
          abi: MOONWELL_MTOKEN_ABI,
          functionName: "redeemUnderlying",
          args: [amountRaw],
        });
        calls.push(buildContractCall(option.contractAddress, data));
      }
      break;
    }
  }

  return calls;
}
