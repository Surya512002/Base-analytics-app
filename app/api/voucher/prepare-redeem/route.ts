import { NextResponse } from "next/server";
import { prepareRedeem, voucherContractReady } from "@/lib/voucher/agent-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/voucher/prepare-redeem
 * Returns unsigned redeem calldata for Base MCP send_calls.
 *
 * Query: cardId=12-3, secret=XXXXX-XXXXX-XXXXX-XXXXX
 */
export async function GET(req: Request) {
  if (!voucherContractReady()) {
    return NextResponse.json(
      { error: "Voucher contract not configured on this deployment." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const cardId = searchParams.get("cardId") || "";
  const secret = searchParams.get("secret") || "";

  if (!cardId || !secret) {
    return NextResponse.json(
      { error: "cardId and secret are required" },
      { status: 400 }
    );
  }

  try {
    const result = await prepareRedeem(cardId, secret);
    const status = result.valid ? 200 : 400;
    return NextResponse.json(result, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[voucher/prepare-redeem]", err);
    return NextResponse.json({ error: "Failed to prepare redeem" }, { status: 500 });
  }
}
