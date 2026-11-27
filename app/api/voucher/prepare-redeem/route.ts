import { NextResponse } from "next/server";
import { prepareRedeem, voucherContractReady } from "@/lib/voucher/agent-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * A card code in a web address ends up in server logs and browser history, so GET is refused without
 * reading the address.
 */
export function GET() {
  return NextResponse.json(
    { error: "Send cardId and secret in a POST JSON body. Card codes are not accepted in the web address." },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } }
  );
}

/**
 * POST /api/voucher/prepare-redeem  { "cardId": "12-3", "secret": "XXXXX-XXXXX-XXXXX-XXXXX" }
 * Returns unsigned redeem calldata for Base MCP send_calls.
 */
export async function POST(req: Request) {
  if (!voucherContractReady()) {
    return NextResponse.json(
      { error: "Voucher contract not configured on this deployment." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    cardId?: string;
    secret?: string;
  };
  const cardId = body.cardId?.trim() || "";
  const secret = body.secret?.trim() || "";

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
