/** One tokenized stock on the Earn page: live price, best rates and the wallet's balance. */
export interface ProtocolRateInfo {
  supplyApy: number;
  borrowApr: number | null;
  liquidityUsd: number;
  protocolLabel: string;
  hasMarket: boolean;
  borrowLabel?: string;
  typeLabel?: string;
}

export interface AssetMarketRow {
  symbol: string;
  name: string;
  category: string;
  address: `0x${string}`;
  /** Real DEX price, or null when the stock has no pool / price hasn't loaded. */
  priceUsd: number | null;
  priceChange24h?: number;
  bestSupplyApy: number;
  bestSupplyProtocol: string;
  /** Plain lending only (no liquidity-pool vaults), for headline figures. 0 when there is none. */
  bestLendApy?: number;
  bestLendProtocol?: string;
  supplyKindChip?: string;
  bestBorrowApr: number | null;
  bestBorrowProtocol: string | null;
  borrowKindChip?: string;
  totalLiquidityUsd: number;
  walletBalance?: number | null;
  walletBalanceUsd?: number | null;
  isNew?: boolean;
  listedProtocols?: string[];
  hasLendingMarket?: boolean;
  riskFlags?: string[];
  oracleVerified?: boolean;
  protocolRates?: Record<string, ProtocolRateInfo>;
}
