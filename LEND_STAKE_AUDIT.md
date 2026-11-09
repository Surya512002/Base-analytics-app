# Lend & Stake Section Audit Report
**Target System:** Base Analytics App (`/components/lending/`, `/lib/lending/`, `/lib/stocks/`, `/app/api/markets/`)  
**Date:** November 9, 2026  
**Auditor:** Antigravity Engine (Read-Only Mode)  
**Status:** Findings & Evidence Only (No Source Code Modified)

---

## 1. DATA SOURCES MAP

This table maps every yield, APY, APR, TVL, and liquidity metric displayed in the Lend & Stake section to its runtime origin.

| Component | Displayed Field | Function / API Source | File & Line | Mode |
| :--- | :--- | :--- | :--- | :--- |
| `MarketsTable` | Supply APY | `stockRows` useMemo from `discoveredMarkets` | `components/lending/LendingHub.tsx:422-450` | LIVE / HARDCODED fallback |
| `MarketsTable` | Borrow APR | `stockRows` useMemo from `discoveredMarkets` | `components/lending/LendingHub.tsx:452-460` | LIVE / HARDCODED fallback |
| `MarketsTable` | Liquidity / TVL | Sum of `matchingMarkets.liquidityUsd` | `components/lending/LendingHub.tsx:483-490` | LIVE / HARDCODED fallback |
| `AssetDetailView` | Best Supply APY | `comparison.bestSupplyOption.supplyApy` | `lib/lending/unified-comparison.ts:755-775` | LIVE / HARDCODED fallback |
| `AssetDetailView` | Best Borrow APR | `comparison.bestBorrowOption.borrowApr` | `lib/lending/unified-comparison.ts:756-780` | HARDCODED fallback (Aave 3.75%) |
| `AssetDetailView` | Total Liquidity | `comparison.totalLiquidityUsd` | `lib/lending/unified-comparison.ts:770` | HARDCODED fallback ($14.8M Aave) |
| `CompareTable` | Table Rows (APY/Liq) | `getUnifiedStockLendingComparison().options` | `lib/lending/unified-comparison.ts:525-738` | MIXED (Beefy/Aero Live, Aave/IPOR Hardcoded) |
| `TopYieldSpotlight` | 4 Highlight Cards | `BASELINE_YIELD_MARKETS` constant | `components/lending/TopYieldSpotlight.tsx:36-90` | HARDCODED (100% static) |
| `ProtocolCompareHub` | Protocol Matrix | `buildProtocolMatrix` | `components/lending/ProtocolCompareHub.tsx:245-320` | MIXED (Hardcoded strings & copy) |
| `GaugesTable` | Gauge APY & TVL | `discoveredMarkets` (Aerodrome & Beefy) | `components/lending/LendingHub.tsx:520-565` | LIVE |
| `YieldFinder` | Opportunities | `discoveredMarkets` with filters | `components/lending/YieldFinder.tsx:45-120` | LIVE |
| `PositionsPanel` | User Supplied/Debt | `fetchAllUserPositions` (Multicall) | `lib/lending/positions-reader.ts:28-120` | LIVE (On-chain viem multicall) |
| `LendingHeader` | Header Stats | `headerStats` useMemo | `components/lending/LendingHub.tsx:570-585` | COMPUTED (from `discoveredMarkets`) |

### Complete List of Hardcoded Values & Fallbacks

1. **`lib/lending/unified-comparison.ts`**:
   - `lines 89-98`: `AAVE_EQUITIES_SUPPORTED_STOCKS` hardcoded Set of 8 stocks (`NVDAc`, `AAPLc`, `MSFTc`, `TSLAc`, `AMZNc`, `GOOGLc`, `METAc`, `SPCXc`).
   - `lines 102-120`: `VERIFIED_BEEFY_STOCK_VAULTS` map with 18 hardcoded vault addresses.
   - `lines 135-242`: `VERIFIED_BEEFY_STOCK_DETAILS` baseline rates (e.g., `NVDAc`: 5.91%, `AAPLc`: 4.82%, `GOOGLc`: 8.21%, `MSFTc`: 4.12%, `TSLAc`: 0.99%, `MSTRc`: 11.45%).
   - `lines 250-322`: `VERIFIED_AERODROME_STOCK_POOLS` baseline rates (e.g., `NVDAc`: 17.64%, `AAPLc`: 9.15%, `TSLAc`: 8.90%).
   - `lines 400-435`: `VERIFIED_IPOR_STOCK_VAULTS` baseline rates (`GOOGc`: 6.15%, `NVDAc`: 7.47%, `AAPLc`: 6.85%, `METAc`: 7.46%, borrow: 4.5%).
   - `lines 487-495`: Fallback reference NAVs (`NVDAc: 138.25`, `SPCXc: 145.0`, `TSLAc/MSTRc: 221.8`, `AAPLc/MSFTc/GOOGLc: 232.5`, default: `125.0`).
   - `lines 703-706`: Synthetic Aave Pro injection (`supplyApy: cleanSymbol === "SPCXc" ? 5.25 : 0`, `borrowApr: 3.75`, `tvlUsd: 14.9M / 34.8M`, `availableLiquidityUsd: 14.8M`).
2. **`components/lending/TopYieldSpotlight.tsx`**:
   - `lines 36-90`: `BASELINE_YIELD_MARKETS` static cards (Aerodrome NVDAc 17.64%, Beefy NVDAc 5.91%, Morpho Blue USDC 4.85%, Moonwell mUSDC 4.65%).
3. **`lib/lending/discovery/adapters/ipor.ts`**:
   - `lines 16-60`: 100% hardcoded array of 4 vaults. No network or on-chain fetch is made.
4. **`lib/lending/discovery/adapters/aerodrome.ts`**:
   - `line 184`: Hardcoded AERO token price `aeroPriceEstimatedUsd = 0.85`.
   - `line 236`: Hardcoded fallback depth `Math.max(10000, Math.round(stakedLpNum * 100))`.
5. **`components/lending/ProtocolCompareHub.tsx`**:
   - `lines 47, 68, 89, 110`: Hardcoded copy strings (`"25% - 290% APY"`, `"15% - 60% APR"`, `"4.60% Supply APY · 3.45% Borrow APR"`).
   - `lines 356, 361, 366`: Hardcoded protocol counts (`"4 Protocols"`, `"3 Protocols"`).
6. **`components/lending/ActionDrawer.tsx`**:
   - `line 833`: Fallback borrow rate string `"3.20%"`.

---

## 2. THE MISMATCH BUG

### Root Pipeline Differences
- **Main Markets Table Pipeline**: `LendingHub.tsx` computes rows via the `stockRows` useMemo (`lines 317-518`). It iterates through `BASE_STOCKS` or `ALL_BASE_STOCKS` and filters `discoveredMarkets` (which is updated client-side by calling `/api/markets?chainId=8453`).
- **Detail View Pipeline**: `AssetDetailView.tsx` consumes the `comparison` state loaded by `loadComparison()` in `LendingHub.tsx:116`. That calls `getUnifiedStockLendingComparison()` in `lib/lending/unified-comparison.ts`.
- **The Core Breakage**:
  1. `getUnifiedStockLendingComparison` races `runMarketDiscovery(8453)` against a **1200ms timeout** (`line 502`). Live discovery takes ~6.3 seconds. Therefore, the detail pipeline **always times out** and falls back to static baseline data (`line 513`).
  2. For 8 equities, `unified-comparison.ts` injects a synthetic Aave Pro option with **3.75% Borrow APR** and **$14.8M liquidity** (`lines 698-738`). In contrast, the main table checks `discoveredMarkets.find(m => m.protocol === "aave")`, which has 0 markets because Aave on Base has no equity reserves. Thus, Table shows `—` borrow, while Detail shows `3.75%` (Aave Pro).
  3. `CompareTable.tsx:30` filters out options where `supplyApy === 0 && borrowApr === null && availableLiquidityUsd === 0`. If all options are filtered, it renders `"No Verified Lending or Staking Pools on Base"`, even if the main table displayed the stock.

### Concrete Disagreeing Stocks (Confirmed by execution)

#### Example 1: `TSLAc` (Tesla Inc.)
| Metric / Field | Main Markets Table | Asset Detail View | Discrepancy Cause |
| :--- | :--- | :--- | :--- |
| **Best Supply APY** | `15.68%` (Pendle) | `15.68%` (Pendle) | Both match Pendle PT market. |
| **Best Borrow APR** | `—` (null / None) | `3.75%` (Aave Pro) | Detail injects synthetic Aave Pro; Table has 0 Aave markets. |
| **Available Liquidity** | `$92,241` | `$14,800,000` | Detail includes synthetic Aave liquidity ($14.8M). |
| **Raw Source Object** | `pendle-0xaDB822593f62752a15edefe9A31e1e9E05DcC13d` (supply: `PENDLE-LPT`, collateral: `TSLAc`) | `TSLAc-aave-equities` synthetic object (`borrowApr: 3.75`) | Synthetic fallback vs live discovery. |

#### Example 2: `GOOGLc` (Alphabet Inc.)
| Metric / Field | Main Markets Table | Asset Detail View | Discrepancy Cause |
| :--- | :--- | :--- | :--- |
| **Best Supply APY** | `20.76%` (Beefy live) | `20.76%` (or `8.21%` on timeout) | If detail times out, it uses baseline 8.21%. |
| **Best Borrow APR** | `4.50%` (IPOR Fusion) | `3.75%` (Aave Pro) | Table selects IPOR (4.5%); Detail chooses synthetic Aave (3.75%). |
| **Total Liquidity** | `$479,597` | `$14,800,000` (Aave) / `$232,268` (Beefy) | Table sums live pools; Detail presents Aave's fake $14.8M. |
| **Raw Source Object** | `beefy-aero-cow-base-usdc-googlc-vault` | `GOOGLc-aave-equities` synthetic object | Divergent selection priority and synthetic injection. |

#### Example 3: `SPCXc` (SpaceX)
| Metric / Field | Main Markets Table | Asset Detail View | Discrepancy Cause |
| :--- | :--- | :--- | :--- |
| **Best Supply APY** | `0.00%` (or `—`) | `5.25%` (Aave Pro) | `unified-comparison.ts:703` hardcodes `isSpcx ? 5.25 : 0` for Aave. Table has 0 Aave. |
| **Best Borrow APR** | `—` (null) | `3.75%` (Aave Pro) | Detail injects synthetic Aave Pro borrow rate. |
| **Total Liquidity** | `$0` | `$14,800,000` | Synthetic Aave liquidity injected in Detail. |
| **Raw Source Object** | None (0 live borrow markets) | `SPCXc-aave-equities` (`supplyApy: 5.25`, `borrowApr: 3.75`) | Hardcoded conditional logic in Detail pipeline. |

### Concrete Agreeing Stocks (Confirmed by execution)

#### Example 1: `RKTc` (Rocket Companies)
| Metric / Field | Main Markets Table | Asset Detail View | Agreement Status |
| :--- | :--- | :--- | :--- |
| **Best Supply APY** | `—` (0.00%) | `—` (None) | Agree: 0 options discovered. |
| **Best Borrow APR** | `—` (null) | `—` (null) | Agree: 0 options discovered. |
| **Available Liquidity** | `—` ($0) | `—` ($0) | Agree: Renders "No Verified Pools" banner. |

#### Example 2: `ABNBc` (Airbnb Inc.)
| Metric / Field | Main Markets Table | Asset Detail View | Agreement Status |
| :--- | :--- | :--- | :--- |
| **Best Supply APY** | `—` (0.00%) | `—` (None) | Agree: 0 options discovered. |
| **Best Borrow APR** | `—` (null) | `—` (null) | Agree: 0 options discovered. |
| **Available Liquidity** | `—` ($0) | `—` ($0) | Agree: Renders "No Verified Pools" banner. |

### Collateral-Only APY Check
**YES, confirmed.** In `components/lending/LendingHub.tsx:422-428`:
```typescript
const supplyMarkets = matchingMarkets.filter(
  (m) =>
    (m.type === "stake" ||
      m.type === "lend" ||
      m.supplyAsset.address.toLowerCase() === stk.address.toLowerCase()) &&
    m.supplyApy > 0
);
```
Because of `m.type === "lend"` or `m.type === "stake"`, any market where the stock is collateral but the supplied asset is another token (e.g. `PENDLE-LPT` or `USDC`) is treated as a stock supply yield.
**Concrete Example**: For `TSLAc`, the main table displays **15.68% Supply APY** from Pendle market `pendle-0xaDB822593f62752a15edefe9A31e1e9E05DcC13d`. However, `m.supplyAsset` is `PENDLE-LPT` (`0xaDB82259...`) and `TSLAc` is only `collateralAsset`. A user holding `TSLAc` cannot deposit `TSLAc` to earn 15.68%.

### CompareTable Zero-Filter Check
**YES, confirmed.** In `components/lending/CompareTable.tsx:30-35`, all options with `supplyApy === 0 && borrowApr === null && availableLiquidityUsd === 0` are discarded. If all options are filtered out, the component renders `"No Verified Lending or Staking Pools on Base"`, completely replacing the table even if the main table counted the stock.

### Root Cause of the Mismatch Bug
> The main table and detail view evaluate different data sources: the main table displays live discovered markets (misidentifying collateral and LP tokens as stock yield), whereas the detail view races discovery against an unachievable 1200ms timeout, defaults to static baselines, and injects synthetic Aave Pro positions with fictitious 3.75% borrow rates and $14.8M liquidity.

---

## 3. API CHECK (`/api/markets?chainId=8453`)

The endpoint was executed and profiled on Base mainnet.

- **Response Time:** 6,305 ms (~6.3s).
- **Total Approved Markets Returned:** 47.
- **Protocol Health Status (`protocolStatus`):**
  - `beefy`: `ok`, 27 markets (all supplyApy > 0).
  - `aerodrome`: `ok`, 8 markets (all supplyApy > 0).
  - `pendle`: `ok`, 8 markets (all supplyApy > 0).
  - `ipor`: `ok`, 4 markets (all supplyApy > 0, hardcoded adapter).
  - `morpho`: `ok`, 0 approved markets (Base GraphQL returns 0 stock collateral markets; general crypto markets filtered out).
  - `aave`: `ok`, 0 approved markets (15 Base reserves found, 0 match tokenized stocks).
  - `moonwell`: `ok`, 0 approved markets (adapter is completely omitted from `engine.ts`).
  - `zkfi`: `ok`, 0 markets.
  - `euler`: `ok`, 0 markets.
  - `superform`: `ok`, 0 markets.

### Error Messages
No unhandled exceptions crashed the route; however, individual RPC calls during discovery log warnings:
- Aave reserve reads on public Base RPC occasionally trigger: `HTTP 429 Too Many Requests`.
- Moonwell never runs because it is missing from `engine.ts:adapters`.

### Unit Consistency Check
All adapters normalize their output to percentage format (e.g. `5.2` means 5.2%), but convert raw upstream numbers inconsistently:
- **Beefy:** Multiplies decimal by 100 (`apy * 100`). Consistent.
- **Pendle:** Multiplies decimal by 100 (`impliedApy * 100`). Consistent.
- **Aerodrome:** Uses hardcoded annual calculation with estimated `$0.85` AERO price and arbitrary `$10,000` depth.
- **Aave V3:** Divides on-chain Ray (`1e27`) by 100. Consistent. However, token asset balance is assigned directly to `tvlUsd` without USD price conversion (e.g., 10 WETH becomes $10 TVL).
- **Moonwell:** Divides rate by `1e18`, multiplies by seconds per year and 100. Consistent. Same token-as-USD bug on TVL.
- **IPOR:** Hardcoded numbers in adapter (`apy: 6.15`). Consistent unit, but fake data.

### Suspicious Values
1. **Beefy micro-liquidity yields:**
   - `SKHYc`: APY `225.86%` on `$2` liquidity.
   - `HIMSc`: APY `226.94%` on `$2.5` liquidity.
   - `CBRSc`: APY `109.02%` on `$2.5` liquidity.
2. **Beefy zero yields on funded vaults:**
   - `PYPLc`: APY `0.00%` on `$2,708` liquidity.
   - `RBLXc`: APY `0.00%` on `$1,694` liquidity.

---

## 4. STOCK COVERAGE

Below is the verified coverage across all 19 active Base stocks in `BASE_STOCKS` (derived from `TOKENIZED_STOCKS_REGISTRY`).

| Symbol | Name | Address | Decimals | Live Discovered Protocols | Hardcoded Fallbacks Present | Coverage Status |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **NVDAc** | NVIDIA Corporation | `0xb200...108C` | 8 | Beefy, Pendle, IPOR, Aerodrome | Beefy, Aerodrome, IPOR, Aave Pro | LIVE |
| **AAPLc** | Apple Inc. | `0xb200...d1fb` | 8 | Beefy, IPOR, Aerodrome | Beefy, Aerodrome, IPOR, Aave Pro | LIVE |
| **MSFTc** | Microsoft Corporation | `0xB200...872B` | 8 | Beefy, Aerodrome | Beefy, Aerodrome, Aave Pro | LIVE |
| **TSLAc** | Tesla Inc. | `0xb200...0cD0` | 8 | Beefy, Pendle, Aerodrome | Beefy, Aerodrome, Aave Pro | LIVE |
| **GOOGLc** | Alphabet Inc. | `0xb200...58B7` | 8 | Beefy, Pendle, IPOR, Aerodrome | Beefy, Aerodrome, IPOR, Aave Pro | LIVE |
| **AMZNc** | Amazon.com Inc. | `0xb200...C2E8` | 8 | Beefy, Aerodrome | Beefy, Aerodrome, Aave Pro | LIVE |
| **METAc** | Meta Platforms Inc. | `0xb200...707C` | 8 | Beefy, IPOR, Aerodrome | Beefy, Aerodrome, IPOR, Aave Pro | LIVE |
| **COINc** | Coinbase Global | `0xb200...ecfb` | 8 | *None* | *None* | **NOTHING** |
| **SPCXc** | SpaceX | `0xb200...CBd5` | 8 | Beefy, Aerodrome | Beefy, Aerodrome, Aave Pro | LIVE |
| **INTCc** | Intel Corporation | `0xB200...dFBc` | 8 | Beefy | Beefy, Aerodrome | LIVE |
| **AMDc** | Advanced Micro Devices | `0xB200...A47B` | 8 | Beefy | Beefy, Aerodrome | LIVE |
| **SKHYc** | SK hynix Inc. | `0xb200...a7d2` | 8 | Beefy | Beefy, Aerodrome | LIVE |
| **ORCLc** | Oracle Corporation | `0xb200...b63C` | 8 | Beefy | Beefy, Aerodrome | LIVE |
| **NFLXc** | Netflix Inc | `0xb200...dFE6` | 8 | Beefy | Beefy, Aerodrome | LIVE |
| **HIMSc** | Hims & Hers Health | `0xB200...f336` | 8 | Beefy | Beefy, Aerodrome | LIVE |
| **LLYc** | Eli Lilly & Co | `0xB200...4718` | 8 | Beefy | Beefy, Aerodrome | LIVE |
| **CBRSc** | Cerebras Systems Inc. | `0xb200...93E2` | 8 | Beefy | Beefy, Aerodrome | LIVE |
| **PYPLc** | PayPal Holdings | `0xb200...6c6E` | 8 | Beefy | Beefy, Aerodrome | LIVE |
| **RBLXc** | Roblox Corporation | `0xB200...9Bb5` | 8 | Beefy | Beefy, Aerodrome | LIVE |

### Full Catalog (`ALL_BASE_STOCKS`)
- Contains **265 tokens** (19 active Backed stocks + 246 additional Backed and Dinari tokens).
- Except for the 19 above and 4 extra Beefy vaults (`MSTRc`, `PLTRc`, `SNDKc`, `MUc`), **242 stocks have 0 live markets and 0 fallbacks**.

### Symbol Discrepancy: `GOOGLc` vs `GOOGc`
- In `TOKENIZED_STOCKS_REGISTRY`: Symbol is `GOOGLc`.
- In IPOR Fusion and some Aerodrome gauges: Listed as `GOOGc`.
- **Finding:** Code contains multiple manual string patches:
  `(cleanSymbol === "GOOGLc" && (m.supplyAsset.symbol.toLowerCase() === "googc" || m.collateralAsset?.symbol.toLowerCase() === "googc"))` in `LendingHub.tsx:326`, `unified-comparison.ts:522`, and `ProtocolCompareHub.tsx:228`.

---

## 5. ERRORS AND WARNINGS

### 1. `npx tsc --noEmit`
Exits with code 1. Zero errors in lending folder. All errors originate from limit orders:
```
app/api/limit-orders/region-check/route.ts(56,9): error TS2304: Cannot find name 'isProduction'.
test/limitOrders/orders-security-and-visibility.test.ts(187,55): error TS2554: Expected 1 arguments, but got 4.
```

### 2. `npm run lint`
Exits with code 1. 161 problems (2 errors in `components/swap/orders/`, 159 warnings).
Lending folder warning:
```
components/lending/MarketsTable.tsx:13:3 warning 'Filter' is defined but never used  @typescript-eslint/no-unused-vars
```

### 3. `npm run build`
Fails during Next.js Type Check due to the limit orders `isProduction` reference in `app/api/limit-orders/region-check/route.ts`.

### 4. Client-Side Console Errors (Wallet Disconnected)
- **Tokenized Stocks Tab (`stocks`):** Runs cleanly without wallet. Shows `console.warn` if public Base RPC encounters HTTP 429 rate limits.
- **Stock Detail View:** Triggers `fetch("https://yields.llama.fi/pools")` in `lib/lending/unified-comparison.ts:341`, downloading a 30MB+ payload. On slower connections, this triggers timeout warnings in the console.
- **Staking & Vaults Tab (`vaults`):** Runs cleanly.
- **Yield Scanner Tab (`finder`):** Runs cleanly.
- **Compare Protocols Tab (`compare`):** Runs cleanly.

---

## 6. TAB-BY-TAB STATUS

1. **Markets Table (`components/lending/MarketsTable.tsx`):**  
   *PARTLY WORKS.* Renders 19 stocks and handles sorting, but displays misleading "Supply APY" from collateral/LP markets and combines TVL/liquidity incorrectly.
2. **Stock Detail Cards (`components/lending/AssetDetailView.tsx`):**  
   *PARTLY WORKS.* Displays stock badges, NAV, and protocol cards, but uses hardcoded fallback NAVs and defaults to `NVDAc` if a Dinari token is clicked.
3. **Compare Table (`components/lending/CompareTable.tsx`):**  
   *PARTLY WORKS.* Displays side-by-side protocol cards, but first-click sort on borrow/risk is descending, and its zero-filter causes "No Verified Pools" banners when markets exist.
4. **Action Drawer (`components/lending/ActionDrawer.tsx`):**  
   *PARTLY WORKS.* Multi-tab drawer opens and pre-simulates transactions, but has hardcoded 8/6 decimals, uses wallet balance instead of supplied balance for withdraws, and shows amount inputs for redirect-only protocols.
5. **Lending Action Modal (`components/lending/LendingActionModal.tsx`):**  
   *PARTLY WORKS.* Can execute attributed on-chain transactions, but withdraw balance reads fail for Morpho/Moonwell/Aave, lacks an Aave withdraw branch, and uses a hardcoded $100 price for borrow liquidity checks.
6. **Gauges Table (`components/lending/GaugesTable.tsx`):**  
   *WORKS.* Accurately displays discovered Aerodrome gauges and Beefy auto-compounding vaults with live APYs, TVLs, and direct action triggers.
7. **Yield Scanner (`components/lending/YieldFinder.tsx`):**  
   *WORKS.* Multi-asset filter and opportunity search across active discovered markets function smoothly with risk badges.
8. **Compare Protocols (`components/lending/ProtocolCompareHub.tsx`):**  
   *PARTLY WORKS.* Protocol matrix renders, but contains hardcoded copy numbers ("4 Protocols", "4.60% Supply") and fictitious Aave Pro equity listings.
9. **Positions Panel (`components/lending/PositionsPanel.tsx`):**  
   *PARTLY WORKS.* Reads real on-chain positions via multicall, but fails to stop polling when document tab is hidden and lacks refresh on network/account switch events.
10. **Liquidation Guard Banner (`components/lending/LiquidationGuardBanner.tsx`):**  
    *WORKS.* Accurately computes position health and displays warnings when health factors decline.
11. **Top Yield Spotlight (`components/lending/TopYieldSpotlight.tsx`):**  
    *BROKEN.* Completely static cards populated from `BASELINE_YIELD_MARKETS` (e.g. 17.64% NVDAc, $1.24M Morpho USDC) regardless of live market conditions.
12. **Header Stats (`components/lending/LendingHeader.tsx`):**  
    *PARTLY WORKS.* Renders pool count and top yield, but double-counts liquidity across overlapping vaults and adds TVL and liquidity together.

---

## 7. TOP 15 PROBLEMS

| Rank | Problem & User Symptom | File & Line | Severity | Confidence |
| :---: | :--- | :--- | :---: | :---: |
| **1** | **Collateral / LP tokens treated as stock supply yield.** Table shows high APY (e.g. TSLAc 15.68%) that cannot be earned by supplying the stock. | `components/lending/LendingHub.tsx:422-428` | **HIGH** | CONFIRMED |
| **2** | **Synthetic Aave Pro equity markets with fake $14.8M liquidity and 3.75% borrow rate.** Aave has no equity market on Base, but Detail shows it. | `lib/lending/unified-comparison.ts:696-738` | **HIGH** | CONFIRMED |
| **3** | **1200ms timeout in Detail pipeline always falls back to baseline.** Live discovery takes ~6.3s, forcing Detail to show stale/static data. | `lib/lending/unified-comparison.ts:501-514` | **HIGH** | CONFIRMED |
| **4** | **Hardcoded decimals (8 for stocks, 6 for loan).** Causes wrong calculation on tokens with 18 decimals (Dinari stocks / LP tokens). | `components/lending/ActionDrawer.tsx:165-167, 270` | **HIGH** | CONFIRMED |
| **5** | **Withdraw tab uses wallet balance instead of supplied balance.** "Available" and Max buttons check wallet tokens, not deposited position. | `components/lending/ActionDrawer.tsx:265-285, 435-437` | **HIGH** | CONFIRMED |
| **6** | **Withdraw balance reads fail for Morpho, Moonwell, and Aave.** Calls `balanceOf(marketAddress)` instead of protocol position functions. | `components/lending/LendingActionModal.tsx:114-150` | **HIGH** | CONFIRMED |
| **7** | **Dinari stock lookup silently defaults to `NVDAc`.** `getBaseStockBySymbol` fails on Dinari tokens, defaulting to `BASE_STOCKS[0]!`. | `lib/lending/unified-comparison.ts:473` | **HIGH** | CONFIRMED |
| **8** | **Missing `aave_v3` withdraw branch and empty calls risk.** Submits empty transactions on certain action/contractType combinations. | `components/lending/LendingActionModal.tsx:438-447` | **HIGH** | CONFIRMED |
| **9** | **TopYieldSpotlight renders 100% static mock data.** 4 cards display static numbers labeled as "Verified". | `components/lending/TopYieldSpotlight.tsx:36-90` | **MEDIUM** | CONFIRMED |
| **10** | **IPOR adapter is 100% hardcoded mock data.** Does not fetch live data; emits 4 static objects with fixed APYs and TVLs. | `lib/lending/discovery/adapters/ipor.ts:16-60` | **MEDIUM** | CONFIRMED |
| **11** | **Moonwell adapter omitted from discovery engine.** Adapter exists in codebase but is not imported or registered in `engine.ts`. | `lib/lending/discovery/engine.ts:8-16, 106-117` | **MEDIUM** | CONFIRMED |
| **12** | **CompareTable zero-filter replaces entire view with "No Verified Pools".** Hides valid markets when APY or borrow APR is 0. | `components/lending/CompareTable.tsx:30-35` | **MEDIUM** | CONFIRMED |
| **13** | **DeFiLlama 30MB+ payload downloaded on client side.** `unified-comparison.ts` fetches `yields.llama.fi/pools` on client every 60s. | `lib/lending/unified-comparison.ts:341` | **MEDIUM** | CONFIRMED |
| **14** | **Token units assigned directly to USD TVL in Aave & Moonwell adapters.** 10 WETH becomes $10 TVL instead of $30,000+. | `lib/lending/discovery/adapters/aave.ts:129`, `moonwell.ts:129` | **MEDIUM** | CONFIRMED |
| **15** | **CompareTable sorts descending on first click for Borrow and Risk.** First click orders highest borrowing cost and highest risk. | `components/lending/CompareTable.tsx:26-27` | **LOW** | CONFIRMED |

---

## 8. OPEN QUESTIONS

1. **Aave Pro Equities Contract:** Does Aave Pro have an unannounced private/permissioned equity pool contract on Base mainnet, or is equity borrowing on `pro.aave.com` strictly off-chain / crypto-collateral only?
2. **IPOR Fusion Live Feed:** Does IPOR provide a public subgraph or REST API for Base Fusion Plasma Vaults, or should rates be read on-chain via the `IPOR_FUSION_FACTORY_BASE` contract?
3. **External Build Failure:** The project build fails due to `isProduction` in `app/api/limit-orders/region-check/route.ts:56:9`. Is there a planned fix for limit orders so `npm run build` can pass cleanly?

---

## APPENDIX: RAW SAMPLES

### Sample A: Live Beefy Discovered Market (`/api/markets?chainId=8453`)
```json
{
  "protocol": "beefy",
  "protocolLabel": "Beefy Finance",
  "marketId": "beefy-aero-cow-base-usdc-googlc-vault",
  "type": "stake",
  "supplyAsset": {
    "symbol": "GOOGLc-USDC",
    "name": "GOOGLc-USDC",
    "address": "0x8Ff449bd7B0073c68C6b5B355B684c7C0d0FEa22",
    "decimals": 18,
    "isStock": true
  },
  "collateralAsset": {
    "symbol": "GOOGLc",
    "name": "Alphabet Inc.",
    "address": "0xb2000000000000000000002D0BA3164cc74f58B7",
    "decimals": 8,
    "isStock": true
  },
  "supplyApy": 20.76,
  "liquidityUsd": 232268,
  "tvlUsd": 232268,
  "status": "active"
}
```

### Sample B: Synthetic Aave Pro Option Injected in `unified-comparison.ts`
```json
{
  "id": "TSLAc-aave-equities",
  "protocol": "aave",
  "protocolName": "Aave Pro",
  "protocolBadge": "Aave · Equities Collateral",
  "type": "variable",
  "typeLabel": "Cross-Collateral Lending Hub",
  "stockSymbol": "TSLAc",
  "stockName": "Tesla Inc.",
  "supplyApy": 0,
  "borrowApr": 3.75,
  "maxLtv": 75,
  "availableLiquidityUsd": 14800000,
  "tvlUsd": 34800000,
  "contractAddress": "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
  "executionType": "aave",
  "sourceLink": "https://pro.aave.com/explore/borrow"
}
```
