import { parseAbi } from "viem";
import { BUILDER_CODE } from "@/lib/constants/env";

export { BUILDER_CODE };

/** Canonical Base Mainnet Protocol Addresses */
export const MORPHO_BLUE_BASE = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as const;
export const MORPHO_ADAPTIVE_CURVE_IRM = "0x46415998764C29aB2a25CbeA6254146D50D22687" as const;

export const AERODROME_ROUTER_BASE = "0xcF77A3ba9A5ca399B7c97c748846942438557642" as const;
export const AERODROME_VOTER_BASE = "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5" as const;
export const AERODROME_VE_BASE = "0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4" as const;
export const AERO_TOKEN_BASE = "0x940181a94A35A4569E4529A3CDfB74e38FD98631" as const;

export const MOONWELL_COMPTROLLER_BASE = "0xfBb21d0380beE3312B33c4353c8936a0F13EF26C" as const;
export const MOONWELL_MUSDC_BASE = "0xeDc817A28E8B93Ca689afb215a5552c41326118B" as const;
export const MOONWELL_MWETH_BASE = "0x628ff693426583D9a7FB391E54366292F509D457" as const;
export const MOONWELL_MCBBTC_BASE = "0xf783307613576082D25089e9FC0a86b9A89345c2" as const;

export const AAVE_V3_POOL_BASE = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5" as const;
export const SUPERFORM_ROUTER_BASE = "0x8e5f31ae56b19d4b4a3c20054a86f9e6144e1d5a" as const;

/** Canonical Tokens on Base */
export const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const WETH_BASE_ADDRESS = "0x4200000000000000000000000000000000000006" as const;
export const CBBTC_BASE_ADDRESS = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf" as const;

/** Minimal ABIs for Direct Mainnet Protocol Interactions */
export const ERC20_ABI = parseAbi([
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
]);

export const CHAINLINK_FEED_ABI = parseAbi([
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() external view returns (uint8)",
  "function description() external view returns (string)",
]);

export const ERC4626_VAULT_ABI = parseAbi([
  "function deposit(uint256 assets, address receiver) external returns (uint256 shares)",
  "function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets)",
  "function totalAssets() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function asset() external view returns (address)",
  "function decimals() external view returns (uint8)",
]);

export const MORPHO_BLUE_ABI = parseAbi([
  "function supply((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) external returns (uint256, uint256)",
  "function withdraw((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) external returns (uint256, uint256)",
  "function borrow((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) external returns (uint256, uint256)",
  "function repay((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) external returns (uint256, uint256)",
  "function supplyCollateral((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, address onBehalf, bytes data) external",
  "function withdrawCollateral((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, address onBehalf, address receiver) external",
  "function position(bytes32 id, address user) external view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)",
  "function market(bytes32 id) external view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
  "function idToMarketParams(bytes32 id) external view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)",
]);

export const AERODROME_GAUGE_ABI = parseAbi([
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function getReward(address account) external",
  "function balanceOf(address account) external view returns (uint256)",
  "function earned(address account) external view returns (uint256)",
]);

export const MOONWELL_MTOKEN_ABI = parseAbi([
  "function mint(uint256 mintAmount) external returns (uint256)",
  "function redeem(uint256 redeemTokens) external returns (uint256)",
  "function redeemUnderlying(uint256 redeemAmount) external returns (uint256)",
  "function borrow(uint256 borrowAmount) external returns (uint256)",
  "function repayBorrow(uint256 repayAmount) external returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function borrowBalanceCurrent(address account) external returns (uint256)",
  "function supplyRatePerTimestamp() external view returns (uint256)",
  "function borrowRatePerTimestamp() external view returns (uint256)",
]);

export const AAVE_V3_POOL_ABI = parseAbi([
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external",
  "function withdraw(address asset, uint256 amount, address to) external returns (uint256)",
  "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external",
  "function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) external returns (uint256)",
]);
