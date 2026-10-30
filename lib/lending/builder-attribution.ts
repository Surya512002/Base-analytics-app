import { encodeFunctionData, parseAbi, type Hex } from "viem";
import { BUILDER_CODE } from "@/lib/constants/env";
import { buildContractCall, type ContractCall } from "@/lib/utils/tx";
import {
  ERC4626_VAULT_ABI,
  AERODROME_GAUGE_ABI,
  MOONWELL_MTOKEN_ABI,
  AAVE_V3_POOL_ABI,
  AAVE_V3_POOL_BASE,
  MORPHO_BLUE_ABI,
  MORPHO_BLUE_BASE,
} from "./constants";

const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/** Attributed ERC-20 approval call */
export function buildAttributedApproveCall(
  token: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint
): ContractCall {
  const data = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [spender, amount],
  });
  return buildContractCall(token, data);
}

/** Attributed MetaMorpho / ERC-4626 Vault Deposit */
export function buildAttributedVaultDepositCall(
  vault: `0x${string}`,
  assets: bigint,
  receiver: `0x${string}`
): ContractCall {
  const data = encodeFunctionData({
    abi: ERC4626_VAULT_ABI,
    functionName: "deposit",
    args: [assets, receiver],
  });
  return buildContractCall(vault, data);
}

/** Attributed MetaMorpho / ERC-4626 Vault Withdraw */
export function buildAttributedVaultWithdrawCall(
  vault: `0x${string}`,
  assets: bigint,
  receiver: `0x${string}`,
  owner: `0x${string}`
): ContractCall {
  const data = encodeFunctionData({
    abi: ERC4626_VAULT_ABI,
    functionName: "withdraw",
    args: [assets, receiver, owner],
  });
  return buildContractCall(vault, data);
}

const BEEFY_VAULT_ABI = parseAbi([
  "function deposit(uint256 _amount) external",
  "function withdraw(uint256 _shares) external",
]);

/** Attributed Beefy Vault Deposit */
export function buildAttributedBeefyDepositCall(
  vault: `0x${string}`,
  amount: bigint
): ContractCall {
  const data = encodeFunctionData({
    abi: BEEFY_VAULT_ABI,
    functionName: "deposit",
    args: [amount],
  });
  return buildContractCall(vault, data);
}

/** Attributed Beefy Vault Withdraw */
export function buildAttributedBeefyWithdrawCall(
  vault: `0x${string}`,
  shares: bigint
): ContractCall {
  const data = encodeFunctionData({
    abi: BEEFY_VAULT_ABI,
    functionName: "withdraw",
    args: [shares],
  });
  return buildContractCall(vault, data);
}

/** Attributed Aerodrome Gauge Deposit / Stake */
export function buildAttributedGaugeDepositCall(
  gauge: `0x${string}`,
  amount: bigint
): ContractCall {
  const data = encodeFunctionData({
    abi: AERODROME_GAUGE_ABI,
    functionName: "deposit",
    args: [amount],
  });
  return buildContractCall(gauge, data);
}

/** Attributed Aerodrome Gauge Withdraw / Unstake */
export function buildAttributedGaugeWithdrawCall(
  gauge: `0x${string}`,
  amount: bigint
): ContractCall {
  const data = encodeFunctionData({
    abi: AERODROME_GAUGE_ABI,
    functionName: "withdraw",
    args: [amount],
  });
  return buildContractCall(gauge, data);
}

/** Attributed Aerodrome Gauge Claim Rewards */
export function buildAttributedGaugeClaimCall(
  gauge: `0x${string}`,
  account: `0x${string}`
): ContractCall {
  const data = encodeFunctionData({
    abi: AERODROME_GAUGE_ABI,
    functionName: "getReward",
    args: [account],
  });
  return buildContractCall(gauge, data);
}

/** Attributed Moonwell Mint / Supply */
export function buildAttributedMoonwellMintCall(
  mToken: `0x${string}`,
  amount: bigint
): ContractCall {
  const data = encodeFunctionData({
    abi: MOONWELL_MTOKEN_ABI,
    functionName: "mint",
    args: [amount],
  });
  return buildContractCall(mToken, data);
}

/** Attributed Moonwell Redeem / Withdraw */
export function buildAttributedMoonwellRedeemCall(
  mToken: `0x${string}`,
  amount: bigint
): ContractCall {
  const data = encodeFunctionData({
    abi: MOONWELL_MTOKEN_ABI,
    functionName: "redeemUnderlying",
    args: [amount],
  });
  return buildContractCall(mToken, data);
}

/** Attributed Moonwell Borrow */
export function buildAttributedMoonwellBorrowCall(
  mToken: `0x${string}`,
  amount: bigint
): ContractCall {
  const data = encodeFunctionData({
    abi: MOONWELL_MTOKEN_ABI,
    functionName: "borrow",
    args: [amount],
  });
  return buildContractCall(mToken, data);
}

/** Attributed Moonwell Repay */
export function buildAttributedMoonwellRepayCall(
  mToken: `0x${string}`,
  amount: bigint
): ContractCall {
  const data = encodeFunctionData({
    abi: MOONWELL_MTOKEN_ABI,
    functionName: "repayBorrow",
    args: [amount],
  });
  return buildContractCall(mToken, data);
}

/** Attributed Aave v3 Supply */
export function buildAttributedAaveSupplyCall(
  asset: `0x${string}`,
  amount: bigint,
  onBehalfOf: `0x${string}`
): ContractCall {
  // Referral code 0 or builder identifier
  const data = encodeFunctionData({
    abi: AAVE_V3_POOL_ABI,
    functionName: "supply",
    args: [asset, amount, onBehalfOf, 0],
  });
  return buildContractCall(AAVE_V3_POOL_BASE, data);
}

/** Attributed Aave v3 Borrow */
export function buildAttributedAaveBorrowCall(
  asset: `0x${string}`,
  amount: bigint,
  onBehalfOf: `0x${string}`,
  interestRateMode: 2 = 2 // 2 = variable rate
): ContractCall {
  const data = encodeFunctionData({
    abi: AAVE_V3_POOL_ABI,
    functionName: "borrow",
    args: [asset, amount, BigInt(interestRateMode), 0, onBehalfOf],
  });
  return buildContractCall(AAVE_V3_POOL_BASE, data);
}

/** Attributed Aave v3 Repay */
export function buildAttributedAaveRepayCall(
  asset: `0x${string}`,
  amount: bigint,
  onBehalfOf: `0x${string}`
): ContractCall {
  const data = encodeFunctionData({
    abi: AAVE_V3_POOL_ABI,
    functionName: "repay",
    args: [asset, amount, BigInt(2), onBehalfOf],
  });
  return buildContractCall(AAVE_V3_POOL_BASE, data);
}

/** Attributed Morpho Blue Supply Collateral */
export function buildAttributedMorphoSupplyCollateralCall(
  marketParams: {
    loanToken: `0x${string}`;
    collateralToken: `0x${string}`;
    oracle: `0x${string}`;
    irm: `0x${string}`;
    lltv: bigint;
  },
  assets: bigint,
  onBehalf: `0x${string}`
): ContractCall {
  const data = encodeFunctionData({
    abi: MORPHO_BLUE_ABI,
    functionName: "supplyCollateral",
    args: [marketParams, assets, onBehalf, "0x" as Hex],
  });
  return buildContractCall(MORPHO_BLUE_BASE, data);
}

/** Attributed Morpho Blue Borrow */
export function buildAttributedMorphoBorrowCall(
  marketParams: {
    loanToken: `0x${string}`;
    collateralToken: `0x${string}`;
    oracle: `0x${string}`;
    irm: `0x${string}`;
    lltv: bigint;
  },
  assets: bigint,
  onBehalf: `0x${string}`,
  receiver: `0x${string}`
): ContractCall {
  const data = encodeFunctionData({
    abi: MORPHO_BLUE_ABI,
    functionName: "borrow",
    args: [marketParams, assets, BigInt(0), onBehalf, receiver],
  });
  return buildContractCall(MORPHO_BLUE_BASE, data);
}

/** Attributed Morpho Blue Repay */
export function buildAttributedMorphoRepayCall(
  marketParams: {
    loanToken: `0x${string}`;
    collateralToken: `0x${string}`;
    oracle: `0x${string}`;
    irm: `0x${string}`;
    lltv: bigint;
  },
  assets: bigint,
  onBehalf: `0x${string}`
): ContractCall {
  const data = encodeFunctionData({
    abi: MORPHO_BLUE_ABI,
    functionName: "repay",
    args: [marketParams, assets, BigInt(0), onBehalf, "0x" as Hex],
  });
  return buildContractCall(MORPHO_BLUE_BASE, data);
}

/** Attributed Morpho Blue Supply (Loan Asset Lending) */
export function buildAttributedMorphoSupplyCall(
  marketParams: {
    loanToken: `0x${string}`;
    collateralToken: `0x${string}`;
    oracle: `0x${string}`;
    irm: `0x${string}`;
    lltv: bigint;
  },
  assets: bigint,
  onBehalf: `0x${string}`
): ContractCall {
  const data = encodeFunctionData({
    abi: MORPHO_BLUE_ABI,
    functionName: "supply",
    args: [marketParams, assets, BigInt(0), onBehalf, "0x" as Hex],
  });
  return buildContractCall(MORPHO_BLUE_BASE, data);
}

/** Attributed Morpho Blue Withdraw Collateral */
export function buildAttributedMorphoWithdrawCollateralCall(
  marketParams: {
    loanToken: `0x${string}`;
    collateralToken: `0x${string}`;
    oracle: `0x${string}`;
    irm: `0x${string}`;
    lltv: bigint;
  },
  assets: bigint,
  onBehalf: `0x${string}`,
  receiver: `0x${string}`
): ContractCall {
  const data = encodeFunctionData({
    abi: MORPHO_BLUE_ABI,
    functionName: "withdrawCollateral",
    args: [marketParams, assets, onBehalf, receiver],
  });
  return buildContractCall(MORPHO_BLUE_BASE, data);
}

/** Attributed Morpho Blue Withdraw Loan Asset */
export function buildAttributedMorphoWithdrawCall(
  marketParams: {
    loanToken: `0x${string}`;
    collateralToken: `0x${string}`;
    oracle: `0x${string}`;
    irm: `0x${string}`;
    lltv: bigint;
  },
  assets: bigint,
  onBehalf: `0x${string}`,
  receiver: `0x${string}`
): ContractCall {
  const data = encodeFunctionData({
    abi: MORPHO_BLUE_ABI,
    functionName: "withdraw",
    args: [marketParams, assets, BigInt(0), onBehalf, receiver],
  });
  return buildContractCall(MORPHO_BLUE_BASE, data);
}

export { BUILDER_CODE };
