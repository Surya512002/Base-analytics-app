import { parseAbi, type Address } from "viem";

/**
 * Aave V4 "Equities Hub" on Base: the market where Coinbase tokenized stocks are collateral for USDC loans.
 * Addresses and behaviour were read from Base on 2026-11-23 (hub from Aave's own link, spokes from the hub):
 *  - Hub 0xa4d5…864E holds the liquidity; the Spoke 0x1790…7B8D is the lending market users talk to.
 *    (The hub's two other spokes are treasury/fee spokes and are not for users.)
 *  - Token approvals go to the SPOKE, not the hub (simulated against live state).
 *  - A first supply does NOT turn collateral on; setUsingAsCollateral(true) is a separate call (simulated).
 *  - Stocks are collateral-only (not borrowable); USDC is the only borrowable asset (reserve 7).
 */
export const AAVE_V4_HUB: Address = "0xa4d5947Eb727A052bae69C593FfC84247EC9864E";
export const AAVE_V4_SPOKE: Address = "0x17905Db0e4A3514467539956c084180616AE7B8D";
export const AAVE_V4_ORACLE: Address = "0xaBaf048fD7675Ea34a84332371ffd5D55E322A47";

/** Reserve ids on the spoke (equal to the hub asset ids). */
export const AAVE_V4_RESERVES = {
  AAPLc: { id: BigInt(0), address: "0xb200000000000000000000C2e324d24d7eEcd1fb" },
  AMZNc: { id: BigInt(1), address: "0xb200000000000000000000d9192b6B456483C2E8" },
  GOOGLc: { id: BigInt(2), address: "0xb2000000000000000000002D0BA3164cc74f58B7" },
  METAc: { id: BigInt(3), address: "0xb2000000000000000000008bC8786B856E61707C" },
  MSFTc: { id: BigInt(4), address: "0xB200000000000000000000Ab99cFa739E253872B" },
  NVDAc: { id: BigInt(5), address: "0xb20000000000000000000078ee7ce2fE4908108C" },
  TSLAc: { id: BigInt(6), address: "0xb2000000000000000000001e800a7f5189430cD0" },
  USDC: { id: BigInt(7), address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  SPCXc: { id: BigInt(8), address: "0xb2000000000000000000007b9fcbd005511aCBd5" },
} as const satisfies Record<string, { id: bigint; address: Address }>;

export const AAVE_V4_USDC_RESERVE_ID = AAVE_V4_RESERVES.USDC.id;

export const AAVE_V4_SPOKE_ABI = parseAbi([
  // writes (every call names the account it acts for; the user always passes their own address)
  "function supply(uint256 reserveId, uint256 amount, address onBehalfOf) returns (uint256, uint256)",
  "function withdraw(uint256 reserveId, uint256 amount, address onBehalfOf) returns (uint256, uint256)",
  "function borrow(uint256 reserveId, uint256 amount, address onBehalfOf) returns (uint256, uint256)",
  "function repay(uint256 reserveId, uint256 amount, address onBehalfOf) returns (uint256, uint256)",
  "function setUsingAsCollateral(uint256 reserveId, bool usingAsCollateral, address onBehalfOf)",
  // reads
  "function getReserveCount() view returns (uint256)",
  "function getReserveConfig(uint256 reserveId) view returns ((uint24 collateralRisk, bool paused, bool frozen, bool borrowable, bool receiveSharesEnabled))",
  "function getDynamicReserveConfig(uint256 reserveId, uint32 dynamicConfigKey) view returns ((uint16 collateralFactor, uint32 maxLiquidationBonus, uint16 liquidationFee))",
  "function getUserAccountData(address user) view returns ((uint256 riskPremium, uint256 avgCollateralFactor, uint256 healthFactor, uint256 totalCollateralValue, uint256 totalDebtValueRay, uint256 activeCollateralCount, uint256 borrowCount))",
  "function getUserSuppliedAssets(uint256 reserveId, address user) view returns (uint256)",
  "function getUserTotalDebt(uint256 reserveId, address user) view returns (uint256)",
  "function getUserReserveStatus(uint256 reserveId, address user) view returns (bool, bool)",
]);

export const AAVE_V4_HUB_ABI = parseAbi([
  "function getAssetDrawnRate(uint256 assetId) view returns (uint256)",
  "function getAddedAssets(uint256 assetId) view returns (uint256)",
  "function getAssetTotalOwed(uint256 assetId) view returns (uint256)",
  "function getAssetLiquidity(uint256 assetId) view returns (uint256)",
  "function getSpokeConfig(uint256 assetId, address spoke) view returns ((uint40 addCap, uint40 drawCap, uint24 riskPremiumThreshold, bool active, bool halted))",
  "function getAssetConfig(uint256 assetId) view returns ((address feeReceiver, uint16 liquidityFee, address irStrategy, address reinvestmentController))",
]);

export const AAVE_V4_ORACLE_ABI = parseAbi([
  "function getReservePrice(uint256 reserveId) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

export const AAVE_V4_LINK = "https://pro.aave.com/explore/hub/ODQ1Mzo6MHhhNGQ1OTQ3RWI3MjdBMDUyYmFlNjlDNTkzRmZDODQyNDdFQzk4NjRF";
