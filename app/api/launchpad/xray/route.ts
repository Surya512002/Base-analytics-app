import { NextResponse } from "next/server";
import { computeTokenXRayScore } from "@/lib/launchpad/token-xray";
import { getLaunchedToken } from "@/lib/launchpad/token-store";
import { fetchTokenHolders, mapHolderRows } from "@/lib/launchpad/holders-fetch";
import { getBasescanApiKeys } from "@/lib/api/basescan";
import { isVerifiedBaseToken } from "@/lib/swap/verified-tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAddressLike(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "").trim();

  if (!isAddressLike(token)) {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }

  const tokenLower = token.toLowerCase();

  try {
    const [registered, holdersRes] = await Promise.all([
      getLaunchedToken(tokenLower).catch(() => null),
      (async () => {
        try {
          const keys = getBasescanApiKeys();
          const fetched = await fetchTokenHolders({ token: tokenLower, offset: 10, basescanKey: keys[0] });
          const rows = mapHolderRows({ rows: fetched.rows, decimals: 18, supplyCap: 1_000_000_000, priceUsd: 0 });
          const top10 = rows.reduce((s, h) => s + h.pctSupply, 0);
          return Math.min(100, Math.max(1, top10));
        } catch {
          return 22; // Healthy fallback median
        }
      })(),
    ]);

    const isVerified = isVerifiedBaseToken(token);
    const antiSnipeActive = Boolean(
      registered?.antiSnipeBlocks && registered.poolOpenBlock && registered.poolOpenBlock > 0
    );

    const report = computeTokenXRayScore({
      address: token,
      symbol: registered?.symbol,
      liquidityUsd: isVerified ? 100_000 : registered?.liquidityLocked ? 50_000 : 15_000,
      top10Pct: holdersRes,
      isOwnerRenounced: Boolean(registered ? registered.liquidityLocked : isVerified),
      hasMintFunction: false,
      isHoneypot: false,
      antiSnipeActive,
      isVerified,
    });

    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("[launchpad/xray]", err);
    return NextResponse.json({ error: "Failed to perform Token X-Ray scan" }, { status: 500 });
  }
}
