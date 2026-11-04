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

const BEEFY_STOCK_VAULT_IDS: Record<string, string> = {
  "0xD317fDf7e7E3BA9dc9A73CAe2E54732646866025": "aero-cow-base-usdc-nvdac-vault",
  "0xD34249514227594BB3bcdDF24a74fe1901D5077e": "aero-cow-base-usdc-aaplc-vault",
  "0x8061731243c1aeFCD50fDD4f69A7618Cdfb3EdD5": "aero-cow-base-msftc-usdc-vault",
  "0xD534d5fe383AE824333C9215DE93D8026eFEDEba": "aero-cow-base-tslac-usdc-vault",
  "0x005b8Aa7aB7bB665902d4E9509B9D4e9fB87BC2b": "aero-cow-base-mstrc-usdc-vault",
  "0x1FF5C4d292F9eACAE1fa10c68f2c546ef8Fc7a8A": "aero-cow-base-amznc-usdc-vault",
  "0x32dB27106d3eeA59A2586E81c4c02aC7a5Ddec49": "aero-cow-base-usdc-metac-vault",
  "0x8Ff449bd7B0073c68C6b5B355B684c7C0d0FEa22": "aero-cow-base-usdc-googlc-vault",
  "0xf336516CDFA8546B92A399305817F525ACcf87f9": "aero-cow-base-sndkc-usdc-vault",
  "0x1361B4DB8b1d8F452B7D3F91bC36B240e32a80BA": "aero-cow-base-pltrc-usdc-vault",
  "0x08C60dEabCbD835E52d5BF8f8800959B54Db8774": "aero-cow-base-usdc-spcxc-vault",
  "0x6b08908A8E1a7197e95d525E5f24EE0bf677369e": "aero-cow-base-muc-usdc-vault",
};

async function fetchLiveBeefyVaults(): Promise<Record<string, { apy: number; tvl: number }>> {
  try {
    const [apyRes, tvlRes] = await Promise.all([
      fetch("https://api.beefy.finance/apy", { next: { revalidate: 60 } }),
      fetch("https://api.beefy.finance/tvl", { next: { revalidate: 60 } }),
    ]);

    if (!apyRes.ok || !tvlRes.ok) return {};
    const apyMap = (await apyRes.json()) as Record<string, number>;
    const tvlMap = (await tvlRes.json()) as Record<string, any>;

    const map: Record<string, { apy: number; tvl: number }> = {};
    for (const [addr, vaultId] of Object.entries(BEEFY_STOCK_VAULT_IDS)) {
      const rawApy = apyMap[vaultId] ? Number(apyMap[vaultId]) * 100 : 0;
      const rawTvl = tvlMap[8453]?.[vaultId] ?? tvlMap[vaultId] ?? 0;
      const apy = Math.round(rawApy * 100) / 100;
      const tvl = Math.round(Number(rawTvl) || 0);
      if (apy > 0 || tvl > 0) {
        map[addr.toLowerCase()] = { apy, tvl };
      }
    }
    return map;
  } catch {
    return {};
  }
}

async function fetchLiveAerodromeYields(): Promise<Record<string, { apy: number; tvl: number }>> {
  try {
    const res = await fetch("https://yields.llama.fi/pools", { next: { revalidate: 120 } });
    if (!res.ok) return {};
    const json = (await res.json()) as any;
    const aeroBase = (json?.data || []).filter(
      (p: any) => p.chain === "Base" && (p.project === "aerodrome" || p.project === "aerodrome-slipstream")
    );

    const map: Record<string, { apy: number; tvl: number }> = {};
    const stockSymbols = [
      "NVDAc", "AAPLc", "MSFTc", "TSLAc", "MSTRc", "AMZNc",
      "METAc", "GOOGLc", "SNDKc", "PLTRc", "SPCXc", "MUc"
    ];

    for (const sym of stockSymbols) {
      const symUpper = sym.toUpperCase();
      const match =
        aeroBase.find((p: any) => {
          const pSym = (p.symbol || "").toUpperCase();
          return pSym.includes(symUpper) && (pSym.includes("USDC") || pSym.includes("USD"));
        }) ||
        aeroBase.find((p: any) => (p.symbol || "").toUpperCase().includes(symUpper));

      if (match) {
        const apy = Math.round(Number(match.apy || 0) * 100) / 100;
        const tvl = Math.round(Number(match.tvlUsd || 0));
        map[sym.toLowerCase()] = { apy, tvl };
      }
    }
    return map;
  } catch {
    return {};
  }
}

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
    // Attempt live state refresh for Morpho, Beefy, and Aerodrome
    const [liveMorpho, liveBeefy, liveAero] = await Promise.all([
      fetchLiveMorphoVaults().catch(() => ({} as Record<string, { apy: number; tvl: number }>)),
      fetchLiveBeefyVaults().catch(() => ({} as Record<string, { apy: number; tvl: number }>)),
      fetchLiveAerodromeYields().catch(() => ({} as Record<string, { apy: number; tvl: number }>)),
    ]);

    markets = markets.map((m) => {
      // 1. Morpho Blue updates
      if (m.protocol === "morpho") {
        const live = liveMorpho[m.contractAddress.toLowerCase()];
        if (live && live.tvl > 0) {
          return {
            ...m,
            supplyApy: live.apy > 0 ? live.apy : m.supplyApy,
            tvlUsd: live.tvl > 0 ? live.tvl : m.tvlUsd,
          };
        }
      }

      // 2. Beefy Finance updates
      if (m.protocol === "beefy") {
        const live = liveBeefy[m.contractAddress.toLowerCase()];
        if (live && (live.apy > 0 || live.tvl > 0)) {
          return {
            ...m,
            supplyApy: live.apy > 0 ? live.apy : m.supplyApy,
            tvlUsd: live.tvl > 0 ? live.tvl : m.tvlUsd,
            badgeText: `${live.apy > 0 ? live.apy : m.supplyApy}% APY · Auto-Compound`,
          };
        }
      }

      // 3. Aerodrome Finance updates
      if (m.protocol === "aerodrome") {
        const stockSym = m.collateralAsset?.symbol?.toLowerCase() || "";
        const live = liveAero[stockSym];
        if (live && (live.apy > 0 || live.tvl > 0)) {
          return {
            ...m,
            supplyApy: live.apy > 0 ? live.apy : m.supplyApy,
            stakingApr: live.apy > 0 ? live.apy : (m.stakingApr ?? m.supplyApy),
            tvlUsd: live.tvl > 0 ? live.tvl : m.tvlUsd,
            badgeText: `${live.apy > 0 ? live.apy : (m.stakingApr ?? m.supplyApy)}% APR · DEX Pool`,
          };
        }
      }

      return m;
    });
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

  return new NextResponse(
    JSON.stringify(
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
      (_key, value) => (typeof value === "bigint" ? value.toString() : value)
    ),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
