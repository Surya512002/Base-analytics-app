import { createPublicClient, http, type PublicClient } from "viem";
import { base } from "viem/chains";
import type { DiscoveryAdapter, NormalizedMarket } from "../types";
import { AAVE_V4_LINK, AAVE_V4_ORACLE, AAVE_V4_RESERVES, AAVE_V4_SPOKE } from "@/lib/lending/aave-v4/constants";
import { readAaveV4Overview } from "@/lib/lending/aave-v4/read";

/**
 * Aave V4 Equities Hub on Base: tokenized stocks go in as collateral, USDC comes out as a loan.
 * Stocks cannot be borrowed and earn no supply yield there ("collateral only at launch"), so each
 * stock appears as a borrow market, like the Morpho stock markets.
 */
export const aaveV4Adapter: DiscoveryAdapter = {
  protocol: "aave_v4",
  protocolLabel: "Aave V4",
  async discoverMarkets(): Promise<NormalizedMarket[]> {
    const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";
    const client = createPublicClient({ chain: base, transport: http(rpcUrl) }) as PublicClient;
    const { stocks, usdc } = await readAaveV4Overview(client);

    return stocks.map((s) => {
      const full = s.capUsedPct >= 100;
      const live = !s.paused && !s.frozen;
      const loanApr = usdc.borrowApr + s.riskPremium; // this collateral's risk premium is added to the base rate
      const loan = { symbol: "USDC", name: "USD Coin", address: AAVE_V4_RESERVES.USDC.address, decimals: 6, isStock: false };
      return {
        protocol: "aave_v4",
        protocolLabel: "Aave V4",
        marketId: `equities-${s.symbol.toLowerCase()}`,
        type: "borrow",
        supplyAsset: loan,
        collateralAsset: { symbol: s.symbol, name: s.symbol, address: s.address, decimals: s.decimals, isStock: true },
        borrowAsset: loan,
        supplyApy: 0, // collateral only: no yield on the stock itself
        borrowApr: Number(loanApr.toFixed(2)),
        maxLtv: s.collateralFactor,
        liquidityUsd: Math.round(usdc.availableUsd),
        tvlUsd: Math.round(s.suppliedUsd),
        utilization: Number(usdc.utilization.toFixed(1)),
        oracle: { address: AAVE_V4_ORACLE, name: "Aave oracle (Chainlink tokenized-equity feeds, 24/5)", isVerified: true, type: "chainlink" },
        canSupply: live && !full,
        canBorrow: live && usdc.borrowable,
        canUseAsCollateral: live,
        riskFlags: [
          "COLLATERAL_ONLY",
          ...(s.riskPremium > 0 ? ["RISK_PREMIUM"] : []),
          ...(s.paused ? ["PAUSED"] : []),
          ...(s.frozen ? ["FROZEN"] : []),
          ...(full ? ["SUPPLY_CAP_REACHED"] : []),
        ],
        sourceLink: AAVE_V4_LINK,
        lastUpdated: new Date().toISOString(),
        status: !live ? "paused" : full ? "cap_reached" : "active",
        badgeText: "Borrow USDC · collateral only · outside the US",
        // The spender for approvals and the contract every call goes to
        contractAddress: AAVE_V4_SPOKE,
      } satisfies NormalizedMarket;
    });
  },
};
