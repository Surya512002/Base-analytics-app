import type { LendingMarket, MarketProtocol } from "@/lib/lending/types";
import type { StockLendingOption } from "@/lib/lending/unified-comparison";
import type { ContractCall } from "@/lib/utils/tx";

export type RiskLevel = "low" | "medium" | "high";

export interface RiskCriteriaExplanation {
  level: RiskLevel;
  title: string;
  summary: string;
  auditStatus: string;
  oracleModel: string;
  isolationModel: string;
}

export function getRiskCriteriaExplanation(level: RiskLevel): RiskCriteriaExplanation {
  switch (level) {
    case "low":
      return {
        level: "low",
        title: "Low Risk Tier",
        summary: "Institutional-grade liquidity, multiple tier-1 security audits, dual Chainlink oracle feeds, and isolated collateral vault parameters.",
        auditStatus: "Audited by OpenZeppelin, Spearbit & Cantina",
        oracleModel: "Chainlink 24/5 Equity Feed + TWAP Fallback",
        isolationModel: "Fully isolated collateral market",
      };
    case "medium":
      return {
        level: "medium",
        title: "Medium Risk Tier",
        summary: "Moderate liquidity depth with active trading volume, verified smart contracts, and standard liquidation buffers.",
        auditStatus: "Audited protocol implementation with bug bounty",
        oracleModel: "Chainlink Onchain Equity Feed",
        isolationModel: "Modular or isolated lending pool",
      };
    case "high":
      return {
        level: "high",
        title: "High Risk Tier",
        summary: "Newer vault strategies, concentrated carry loops, or lower liquidity depth with elevated price volatility exposure.",
        auditStatus: "Protocol audit verified; strategy vault in incubation",
        oracleModel: "Composite DEX TWAP / Feed",
        isolationModel: "Cross-margin or leveraged yield strategy",
      };
  }
}

export interface ProtocolAdapter {
  protocol: MarketProtocol;
  protocolName: string;
  badge: string;
  getMarkets: (markets: LendingMarket[]) => LendingMarket[];
  buildSupplyTx?: (market: LendingMarket, amount: bigint, user: `0x${string}`) => ContractCall[];
  buildBorrowTx?: (market: LendingMarket, amount: bigint, user: `0x${string}`) => ContractCall[];
  buildRepayTx?: (market: LendingMarket, amount: bigint, user: `0x${string}`) => ContractCall[];
  buildWithdrawTx?: (market: LendingMarket, amount: bigint, user: `0x${string}`) => ContractCall[];
}
