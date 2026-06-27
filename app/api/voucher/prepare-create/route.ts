import { NextResponse } from "next/server";
import {
  prepareCreateBatch,
  voucherContractReady,
} from "@/lib/voucher/agent-api";
import { MAX_VOUCHER_CARDS, type VoucherAsset } from "@/lib/utils/voucher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/voucher/prepare-create
 * Returns unsigned calldata + generated card secrets for Base MCP send_calls.
 *
 * Query: asset=USDC|ETH, total=10, cards=5, message=..., creator=0x... (optional, for USDC allowance)
 */
export async function GET(req: Request) {
  if (!voucherContractReady()) {
    return NextResponse.json(
      { error: "Voucher contract not configured on this deployment." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const asset = (searchParams.get("asset") || "USDC").toUpperCase() as VoucherAsset;
  if (asset !== "USDC" && asset !== "ETH") {
    return NextResponse.json({ error: "asset must be USDC or ETH" }, { status: 400 });
  }

  const total = searchParams.get("total") || "";
  const cards = parseInt(searchParams.get("cards") || "", 10);
  const message = searchParams.get("message") || "";
  const creator = searchParams.get("creator")?.trim() as `0x${string}` | undefined;

  if (!total) {
    return NextResponse.json({ error: "total is required" }, { status: 400 });
  }
  if (!Number.isFinite(cards) || cards < 1 || cards > MAX_VOUCHER_CARDS) {
    return NextResponse.json(
      { error: `cards must be 1–${MAX_VOUCHER_CARDS}` },
      { status: 400 }
    );
  }
  if (creator && !creator.startsWith("0x")) {
    return NextResponse.json({ error: "creator must be a 0x address" }, { status: 400 });
  }

  try {
    const result = await prepareCreateBatch({
      asset,
      total,
      cards,
      message,
      creator,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[voucher/prepare-create]", err);
    return NextResponse.json({ error: "Failed to prepare create batch" }, { status: 500 });
  }
}
