import { NextResponse } from "next/server";
import { BASE_LENDING_MARKETS } from "@/lib/lending/markets";
import { BUILDER_CODE } from "@/lib/constants/env";

export const dynamic = "force-dynamic";

type MorphoVaultItem = {
  address: string;
  name: string;
  symbol: string;
  asset: { symbol: string; address: string; decimals: number };
  state?: { totalAssetsUsd?: number | null; netApy?: number | null };
};

async function fetchLiveMorphoVaults(): Promise<Record<string, { apy: number; tvl: number }>> {
  try {
    const res = await fetch("https://blue-api.morpho.org/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{
          vaults(first: 20, orderBy: TotalAssetsUsd, orderDirection: Desc, where: { chainId_in: [8453] }) {
            items {
              address
              name
              symbol
              state {
                totalAssetsUsd
                netApy
              }
            }
          }
        }`,
      }),
      next: { revalidate: 60 },
    });

    if (!res.ok) return {};
    const json = (await res.json()) as { data?: { vaults?: { items?: MorphoVaultItem[] } } };
    const items = json?.data?.vaults?.items ?? [];

    const map: Record<string, { apy: number; tvl: number }> = {};
    for (const v of items) {
      if (!v?.address) continue;
      const apy = (v.state?.netApy ?? 0) * 100;
      const tvl = v.state?.totalAssetsUsd ?? 0;
      map[v.address.toLowerCase()] = { apy: Number(apy.toFixed(2)), tvl: Math.round(tvl) };
    }
    return map;
  } catch {
    return {};
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filterCat = searchParams.get("category");
  const filterProto = searchParams.get("protocol");
  const filterStocks = searchParams.get("stocks") === "true";

  let markets = [...BASE_LENDING_MARKETS];

  try {
    // Attempt live Morpho state refresh
    const liveMorpho = await fetchLiveMorphoVaults();
    if (Object.keys(liveMorpho).length > 0) {
      markets = markets.map((m) => {
        const live = liveMorpho[m.contractAddress.toLowerCase()];
        if (live && live.tvl > 0) {
          return {
            ...m,
            supplyApy: live.apy > 0 ? live.apy : m.supplyApy,
            tvlUsd: live.tvl > 0 ? live.tvl : m.tvlUsd,
          };
        }
        return m;
      });
    }
  } catch {
    /* fallback to curated constants */
  }

  if (filterStocks) {
    markets = markets.filter((m) => m.isStockFocus);
  }
  if (filterCat && filterCat !== "all") {
    if (filterCat === "supervaults") {
      markets = markets.filter((m) => m.protocol === "superform" || m.contractType === "superform_vault");
    } else {
      markets = markets.filter((m) => m.category === filterCat);
    }
  }
  if (filterProto && filterProto !== "all") {
    markets = markets.filter((m) => m.protocol === filterProto);
  }

  const totalTvlUsd = markets.reduce((acc, m) => acc + m.tvlUsd, 0);
  const stockMarketsCount = markets.filter((m) => m.isStockFocus).length;

  return NextResponse.json(
    {
      markets,
      summary: {
        totalMarkets: markets.length,
        stockMarketsCount,
        totalTvlUsd,
        builderCode: BUILDER_CODE,
        attributionStatus: "active",
        network: "Base Mainnet (8453)",
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
