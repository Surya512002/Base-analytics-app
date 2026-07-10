import { NextResponse } from "next/server";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { getLaunchedToken } from "@/lib/launchpad/token-store";
import { evaluateAntiSnipe } from "@/lib/launchpad/anti-snipe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "").trim().toLowerCase();
  const direction = searchParams.get("direction") === "sell" ? "sell" : "buy";

  if (!token.startsWith("0x") || token.length !== 42) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const registered = await getLaunchedToken(token);
  const pub = createBasePublicClient();
  const currentBlock = Number(await pub.getBlockNumber());

  const status = evaluateAntiSnipe({
    currentBlock,
    poolOpenBlock: registered?.poolOpenBlock,
    antiSnipeBlocks: registered?.antiSnipeBlocks,
    direction,
  });

  return NextResponse.json({
    ...status,
    launchBlock: registered?.launchBlock ?? null,
    currentBlock,
  });
}
