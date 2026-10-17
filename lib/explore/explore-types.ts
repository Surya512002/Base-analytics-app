export type TokenType = "b20" | "stock" | "base";

export interface UnifiedToken {
  id: string;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  type: TokenType;
  imageUrl?: string;
  description?: string;
  createdAt?: number;
  creator?: string;

  // Market stats
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  liquidityUsd: number;
  marketCapUsd: number;
  hasPool: boolean;
  pairAddress?: string;
  dexId?: string;
  dexUrl?: string;

  // User state
  isMine?: boolean;
  isWatched?: boolean;
  holdingBalance?: number;
  holdingUsd?: number;
}

export type TokenSortOption =
  | "trending"
  | "newest"
  | "gainers"
  | "losers"
  | "volume"
  | "mcap";

export type ExploreCatalogTab = "all" | "stocks" | "b20" | "ecosystem";

export interface ExploreFiltersState {
  catalogTab: ExploreCatalogTab;
  sort: TokenSortOption;
  searchQuery: string;
  onlyWatching: boolean;
  onlyMine: boolean;
  hideLowLiquidity: boolean;
  viewMode: "table" | "grid";
}
