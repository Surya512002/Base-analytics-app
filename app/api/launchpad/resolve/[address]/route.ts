import { NextResponse } from "next/server";
import { resolveTradeableToken } from "@/lib/launchpad/resolve-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Resolve app-launched or external DexScreener token for trading. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ address: string }> }
) {
  const { address } = await ctx.params;
  try {
    const { token, market } = await resolveTradeableToken(address);
    if (!token) {
      return NextResponse.json(
        { error: "No liquidity found for this token on Base" },
        { status: 404 }
      );
    }
    return NextResponse.json({ token, market });
  } catch (e) {
    console.error("[launchpad/resolve]", e);
    return NextResponse.json({ error: "Failed to resolve token" }, { status: 500 });
  }
}
