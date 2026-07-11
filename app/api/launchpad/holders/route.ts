import { NextResponse } from "next/server";
import { getBasescanApiKeys } from "@/lib/api/basescan";
import { parseSupplyCap } from "@/lib/launchpad/format";
import { fetchTokenHolders, mapHolderRows } from "@/lib/launchpad/holders-fetch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAddressLike(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "").trim();
  const offset = Math.max(
    1,
    Math.min(10, parseInt(searchParams.get("offset") || "10", 10) || 10)
  );
  const decimals = Math.min(
    18,
    Math.max(6, parseInt(searchParams.get("decimals") || "18", 10))
  );
  const priceUsd = parseFloat(searchParams.get("priceUsd") || "0");
  const supplyCap = parseSupplyCap(searchParams.get("supplyCap") || "1B");
  const pool = (searchParams.get("pool") || "").trim().toLowerCase();
  const creator = (searchParams.get("creator") || "").trim().toLowerCase();

  if (!isAddressLike(token)) {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }

  const keys = getBasescanApiKeys();

  try {
    const fetched = await fetchTokenHolders({
      token,
      offset,
      basescanKey: keys[0],
    });

    const holders = mapHolderRows({
      rows: fetched.rows,
      decimals,
      supplyCap,
      priceUsd,
      pool,
      creator,
    });

    const top10Pct = holders.reduce((s, h) => s + h.pctSupply, 0);

    return NextResponse.json({
      holders,
      top10Pct,
      source: fetched.source,
      ...(fetched.error && !holders.length ? { error: fetched.error } : {}),
    });
  } catch (e) {
    console.error("[launchpad/holders]", e);
    return NextResponse.json(
      { holders: [], error: "Holders fetch failed", source: "none" },
      { status: 200 }
    );
  }
}
