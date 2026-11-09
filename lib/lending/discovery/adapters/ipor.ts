import type { DiscoveryAdapter, NormalizedMarket } from "../types";

export const iporAdapter: DiscoveryAdapter = {
  protocol: "ipor",
  protocolLabel: "IPOR Fusion",
  async discoverMarkets(chainId: number): Promise<NormalizedMarket[]> {
    if (chainId !== 8453) return [];
    // Currently IPOR Fusion has no verified live tokenized stock carry trade vaults deployed on Base mainnet.
    // Return empty list rather than hardcoded mock APYs/TVLs.
    return [];
  },
};
