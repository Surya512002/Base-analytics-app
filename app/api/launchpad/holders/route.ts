import { NextResponse } from "next/server";
import { getBasescanApiKeys } from "@/lib/api/basescan";
import { parseSupplyCap } from "@/lib/launchpad/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE_CHAIN_ID = 8453;

function isAddressLike(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

function etherscanV2Url(apiKey: string, params: Record<string, string>): string {
  const q = new URLSearchParams({
    chainid: String(BASE_CHAIN_ID),
    ...params,
    apikey: apiKey,
  });
  return `https://api.etherscan.io/v2/api?${q.toString()}`;
}

type TokenHolderRow = {
  TokenHolderAddress?: string;
  TokenHolderQuantity?: string;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "").trim();
  const offset = Math.max(1, Math.min(10, parseInt(searchParams.get("offset") || "10", 10) || 10));
  const decimals = Math.min(18, Math.max(6, parseInt(searchParams.get("decimals") || "18", 10)));
  const priceUsd = parseFloat(searchParams.get("priceUsd") || "0");
  const supplyCap = parseSupplyCap(searchParams.get("supplyCap") || "1B");
  const pool = (searchParams.get("pool") || "").trim().toLowerCase();
  const creator = (searchParams.get("creator") || "").trim().toLowerCase();

  if (!isAddressLike(token)) {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }

  const keys = getBasescanApiKeys();
  if (!keys.length) {
    return NextResponse.json({ holders: [], error: "Missing BaseScan API key" }, { status: 200 });
  }

  try {
    const url = etherscanV2Url(keys[0]!, {
      module: "token",
      action: "tokenholderlist",
      contractaddress: token,
      page: "1",
      offset: String(offset),
    });

    const r = await fetch(url, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(12_000),
    });
    const data = (await r.json()) as {
      status?: string;
      message?: string;
      result?: TokenHolderRow[] | string;
    };

    if (!r.ok) {
      return NextResponse.json({ holders: [], error: "Failed to fetch holders" }, { status: 200 });
    }

    if (!Array.isArray(data.result)) {
      const msg =
        typeof data.result === "string"
          ? data.result
          : data.message || "Holders unavailable";
      return NextResponse.json({ holders: [], error: msg }, { status: 200 });
    }

    const holders = data.result
      .map((row) => {
        const address = row.TokenHolderAddress || "";
        const quantity = row.TokenHolderQuantity || "0";
        let balance = 0;
        try {
          balance = Number(BigInt(quantity)) / 10 ** decimals;
        } catch {
          balance = 0;
        }
        const pctSupply = supplyCap > 0 ? (balance / supplyCap) * 100 : 0;
        const valueUsd = priceUsd > 0 ? balance * priceUsd : 0;
        const addrLower = address.toLowerCase();
        let tag = "Wallet";
        if (pool && addrLower === pool) tag = "Pool liquidity";
        else if (creator && addrLower === creator) tag = "Creator";

        return {
          address,
          quantity,
          balance,
          pctSupply,
          valueUsd,
          tag,
        };
      })
      .filter((h) => isAddressLike(h.address));

    const top10Pct = holders.reduce((s, h) => s + h.pctSupply, 0);

    return NextResponse.json({ holders, top10Pct });
  } catch (e) {
    console.error("[launchpad/holders]", e);
    return NextResponse.json({ holders: [], error: "Holders fetch failed" }, { status: 200 });
  }
}
