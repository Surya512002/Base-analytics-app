import type { Address } from "viem";
import type { BaseStock } from "@/lib/stocks/base-stocks";
import { areStockSymbolsEquivalent } from "@/lib/stocks/base-stocks";
import type { NormalizedMarket, DiscoveryProtocol } from "@/lib/lending/discovery/types";
import { MIN_TVL_USD } from "@/lib/lending/constants";

export type MarketRole = "lend" | "borrow" | "lp_vault";
export type KindChip = "Lend" | "Borrow" | "LP Vault" | "DEX LP" | "Pendle PT/YT";

export interface ClassifiedMarketOption {
  id: string;
  protocol: DiscoveryProtocol;
  protocolLabel: string;
  protocolBadge: string;
  role: MarketRole;
  roleLabel: string;
  kindChip: KindChip;
  riskNote: string;
  supplyApy: number;
  borrowApr: number | null;
  maxLtv: number | null;
  liquidityUsd: number;
  tvlUsd: number;
  isLowLiquidity: boolean;
  contractAddress: Address;
  marketId: string;
  sourceLink?: string;
  utilization: number;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  riskNotes: string[];
  rawMarket: NormalizedMarket;
}

export interface StockMarketSummary {
  stock: BaseStock;
  options: ClassifiedMarketOption[];
  // Shared selectors
  bestLendOption: ClassifiedMarketOption | null; // Pure stock lending only
  bestBorrowOption: ClassifiedMarketOption | null; // Stock collateral borrow only
  bestLpOption: ClassifiedMarketOption | null; // LP / Vault yield
  bestOverallYieldOption: ClassifiedMarketOption | null; // Highest yield among lend & LP above MIN_TVL_USD
  deepestOption: ClassifiedMarketOption | null; // Highest liquidity option
  totalLiquidityUsd: number;
  listedProtocols: string[];
  hasLendingMarket: boolean;
  hasLowLiquidityOnly: boolean;
}

/**
 * Check if a normalized market relates to a given tokenized stock
 */
export function isMarketForStock(m: NormalizedMarket, stock: BaseStock): boolean {
  const stockAddr = stock.address.toLowerCase();
  const stockSym = stock.symbol;

  // 1. Direct address match
  if (m.supplyAsset.address.toLowerCase() === stockAddr) return true;
  if (m.collateralAsset?.address.toLowerCase() === stockAddr) return true;

  // 2. Direct symbol match
  if (areStockSymbolsEquivalent(m.supplyAsset.symbol, stockSym)) return true;
  if (m.collateralAsset && areStockSymbolsEquivalent(m.collateralAsset.symbol, stockSym)) return true;

  // 3. Substring / Token pair match for LP tokens (e.g. "GOOGLc-USDC", "NVDAc/USDC")
  const parts = m.supplyAsset.symbol.toLowerCase().split(/[-_/\s]/);
  if (parts.some((p) => areStockSymbolsEquivalent(p, stockSym))) return true;

  // 4. MarketId ticker match
  if (m.marketId) {
    const idParts = m.marketId.toLowerCase().split(/[-_]/);
    if (idParts.some((p: string) => areStockSymbolsEquivalent(p, stockSym))) return true;
  }

  return false;
}

/**
 * Pure classifier assigning exactly one role to every market for a stock:
 * - "lend": Pure stock lending (stock itself is deposited to earn).
 * - "borrow": Stock collateral borrowing (stock is pledged as collateral).
 * - "lp_vault": LP / Vault / Gauge (stock is a constituent paired with USDC/WETH).
 */
export function classifyMarketForStock(
  m: NormalizedMarket,
  stock: BaseStock
): ClassifiedMarketOption {
  const stockAddr = stock.address.toLowerCase();
  const stockSym = stock.symbol;
  const isSupplyPureStock =
    (m.supplyAsset.address.toLowerCase() === stockAddr ||
      areStockSymbolsEquivalent(m.supplyAsset.symbol, stockSym)) &&
    !m.supplyAsset.symbol.includes("-") &&
    !m.supplyAsset.symbol.includes("/") &&
    m.protocol !== "beefy" &&
    m.protocol !== "aerodrome" &&
    m.protocol !== "pendle";

  const isStockCollateral = Boolean(
    m.collateralAsset &&
      (m.collateralAsset.address.toLowerCase() === stockAddr ||
        areStockSymbolsEquivalent(m.collateralAsset.symbol, stockSym))
  );

  let role: MarketRole;
  let roleLabel: string;
  let kindChip: KindChip;
  let riskNote: string;
  let riskScore = 2;
  let riskLevel: "low" | "medium" | "high" = "low";
  const riskNotes: string[] = [];

  if (isStockCollateral && (m.type === "borrow" || (m.canBorrow && (m.borrowApr ?? 0) > 0))) {
    role = "borrow";
    roleLabel = "Stock Collateral Borrow";
    kindChip = "Borrow";
    riskNote = "Borrowing cash against tokenized stock collateral. Subject to liquidation risk.";
    riskScore = 3;
    riskNotes.push(
      "Deposit tokenized stock as collateral to borrow USDC.",
      "Subject to liquidation if price falls below the liquidation threshold."
    );
  } else if (isSupplyPureStock && m.type === "lend") {
    role = "lend";
    roleLabel = "Pure Stock Lending";
    kindChip = "Lend";
    riskNote = "Direct tokenized stock deposit. Earns securities lending yield.";
    riskScore = 2;
    riskNotes.push(
      "Direct tokenized stock deposit with audited smart contract custody.",
      "Zero liquidation risk; standard money market supply."
    );
  } else {
    role = "lp_vault";
    roleLabel = "LP / Vault yield (pair with USDC)";
    if (m.protocol === "pendle") {
      kindChip = "Pendle PT/YT";
      riskScore = 4;
      riskLevel = "medium";
      riskNote = "Yield trading / PT tokens. Locked term until maturity.";
      riskNotes.push(
        "Tokenized yield trading market.",
        "Requires locking or LP staking until fixed maturity date."
      );
    } else if (m.protocol === "aerodrome") {
      kindChip = "DEX LP";
      riskNote = "DEX liquidity pool paired with USDC. Subject to impermanent loss.";
      riskNotes.push(
        "Requires providing equal value of USDC and tokenized stock.",
        "Subject to impermanent loss and trading volume fluctuations."
      );
    } else {
      kindChip = "LP Vault";
      riskNote = "Auto-compounding vault paired with USDC. Subject to impermanent loss.";
      riskNotes.push(
        "Auto-harvests LP rewards and compounds them back into pool shares.",
        "Underlying position is paired with USDC; subject to impermanent loss."
      );
    }
  }

  const effectiveLiquidity = m.liquidityUsd > 0 ? m.liquidityUsd : (m.tvlUsd || 0);
  const isLowLiquidity = effectiveLiquidity < MIN_TVL_USD;
  if (isLowLiquidity) {
    riskNotes.push(`Low liquidity warning: Pool depth is under $${MIN_TVL_USD.toLocaleString()} USD.`);
  }

  const contractAddress = (m.contractAddress ||
    m.supplyAsset.address ||
    "0x0000000000000000000000000000000000000000") as Address;

  return {
    id: `${m.protocol}-${m.marketId}`,
    protocol: m.protocol,
    protocolLabel: m.protocolLabel,
    protocolBadge: `${m.protocolLabel} · ${kindChip}`,
    role,
    roleLabel,
    kindChip,
    riskNote,
    supplyApy: m.supplyApy || 0,
    borrowApr: m.borrowApr ?? null,
    maxLtv: m.maxLtv || null,
    liquidityUsd: m.liquidityUsd || 0,
    tvlUsd: m.tvlUsd || 0,
    isLowLiquidity,
    contractAddress,
    marketId: m.marketId,
    sourceLink: m.sourceLink,
    utilization: m.utilization || 0,
    riskScore,
    riskLevel,
    riskNotes,
    rawMarket: m,
  };
}

/**
 * Derives unified market options and summary statistics for a tokenized stock.
 * Both the main table and the detail view MUST consume this function.
 */
export function deriveStockMarketOptions(
  stock: BaseStock,
  markets: NormalizedMarket[]
): StockMarketSummary {
  // 1. Filter all discovered markets matching this stock
  const matchingMarkets = (markets || []).filter((m) => isMarketForStock(m, stock));

  // 2. Classify every matching market into exactly one role
  const options = matchingMarkets.map((m) => classifyMarketForStock(m, stock));

  // 3. Extract unique listed protocols
  const protoSet = new Set<string>();
  for (const opt of options) {
    if (opt.protocolLabel) protoSet.add(opt.protocolLabel);
  }
  const listedProtocols = Array.from(protoSet);

  // 4. Calculate total distinct liquidity
  const totalLiquidityUsd = options.reduce((sum, opt) => {
    const depth = opt.liquidityUsd > 0 ? opt.liquidityUsd : opt.tvlUsd;
    return sum + depth;
  }, 0);

  // 5. Select Best Lend Option (Pure stock lending only, above MIN_TVL_USD)
  const fundedLendOptions = options.filter(
    (o) => o.role === "lend" && !o.isLowLiquidity && o.supplyApy > 0
  );
  const bestLendOption =
    fundedLendOptions.sort((a, b) => b.supplyApy - a.supplyApy)[0] ?? null;

  // 6. Select Best Borrow Option (Stock collateral borrow only, above MIN_TVL_USD)
  const fundedBorrowOptions = options.filter(
    (o) => o.role === "borrow" && !o.isLowLiquidity && (o.borrowApr ?? 0) > 0
  );
  const bestBorrowOption =
    fundedBorrowOptions.sort((a, b) => (a.borrowApr ?? 999) - (b.borrowApr ?? 999))[0] ?? null;

  // 7. Select Best LP Option (LP / Vault yield, above MIN_TVL_USD)
  const fundedLpOptions = options.filter(
    (o) => o.role === "lp_vault" && !o.isLowLiquidity && o.supplyApy > 0
  );
  const bestLpOption =
    fundedLpOptions.sort((a, b) => b.supplyApy - a.supplyApy)[0] ?? null;

  // 8. Select Best Overall Yield Option (highest rate between pure lend & LP)
  const yieldCandidates = [bestLendOption, bestLpOption].filter(
    (o): o is ClassifiedMarketOption => o !== null
  );
  const bestOverallYieldOption =
    yieldCandidates.sort((a, b) => b.supplyApy - a.supplyApy)[0] ?? null;

  // 9. Select Deepest Liquidity Option
  const deepestOption =
    options.length > 0
      ? [...options].sort(
          (a, b) =>
            Math.max(b.liquidityUsd, b.tvlUsd) - Math.max(a.liquidityUsd, a.tvlUsd)
        )[0]
      : null;

  const hasLendingMarket = options.length > 0;
  const hasLowLiquidityOnly =
    options.length > 0 && options.every((o) => o.isLowLiquidity);

  return {
    stock,
    options,
    bestLendOption,
    bestBorrowOption,
    bestLpOption,
    bestOverallYieldOption,
    deepestOption,
    totalLiquidityUsd,
    listedProtocols,
    hasLendingMarket,
    hasLowLiquidityOnly,
  };
}
