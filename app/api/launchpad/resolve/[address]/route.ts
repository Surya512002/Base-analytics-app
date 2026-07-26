import { NextResponse } from "next/server";
import { resolveTradeableToken } from "@/lib/launchpad/resolve-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Resolve any Base ERC-20 for trading: registry, DexScreener, then on-chain. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ address: string }> }
) {
  const { address } = await ctx.params;
  try {
    const { token, market } = await resolveTradeableToken(address);
    if (!token) {
      return NextResponse.json(
        { error: "That address is not an ERC-20 token on Base" },
        { status: 404 }
      );
    }
    return NextResponse.json({ token, market });
  } catch (e) {
    console.error("[launchpad/resolve]", e);
    return NextResponse.json({ error: "Failed to resolve token" }, { status: 500 });
  }
}
