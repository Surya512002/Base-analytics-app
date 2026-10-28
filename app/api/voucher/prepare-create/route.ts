import { NextResponse } from "next/server";
import {
  prepareCreateBatch,
  voucherContractReady,
} from "@/lib/voucher/agent-api";
import { MAX_VOUCHER_CARDS, isStockAsset, type VoucherAsset } from "@/lib/utils/voucher";
import {
  complianceConfig,
  evaluateRegionCompliance,
  fetchRemoteKillSwitch,
} from "@/src/config/compliance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/voucher/prepare-create
 * Returns unsigned calldata + generated card secrets for Base MCP send_calls.
 *
 * Query: asset=USDC|ETH|NVDAc|AAPLc, total=10, cards=5, message=..., creator=0x... (optional, for allowance)
 */
export async function GET(req: Request) {
  if (!voucherContractReady()) {
    return NextResponse.json(
      { error: "Voucher contract not configured on this deployment." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const rawAsset = (searchParams.get("asset") || "USDC").trim();
  const asset = (rawAsset.toUpperCase() === "ETH" ? "ETH" : rawAsset.toUpperCase() === "USDC" ? "USDC" : rawAsset) as VoucherAsset;
  if (asset !== "USDC" && asset !== "ETH" && !isStockAsset(asset)) {
    return NextResponse.json({ error: "asset must be USDC, ETH, or a supported stock (e.g. NVDAc, AAPLc, TSLAc)" }, { status: 400 });
  }

  if (isStockAsset(asset)) {
    const killSwitch = await fetchRemoteKillSwitch();
    if (killSwitch) {
      return NextResponse.json(
        { error: "Tokenized stock features are temporarily paused via safety kill switch." },
        { status: 403 }
      );
    }
    if (!complianceConfig.features["stocks.vouchers"]) {
      return NextResponse.json(
        { error: "Tokenized stock voucher creation is currently disabled." },
        { status: 403 }
      );
    }
    const country =
      req.headers.get("x-vercel-ip-country") ||
      req.headers.get("cf-ipcountry") ||
      req.headers.get("x-user-country") ||
      null;
    const regionEvaluation = evaluateRegionCompliance(country, "stocks.vouchers");
    if (regionEvaluation.isRestricted && !regionEvaluation.canEnter) {
      return NextResponse.json(
        { error: "Tokenized stock features are not available in your region" },
        { status: 403 }
      );
    }
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

/** POST — preferred for UI; requires creator so secrets are saved by wallet address before deposit. */
export async function POST(req: Request) {
  if (!voucherContractReady()) {
    return NextResponse.json(
      { error: "Voucher contract not configured on this deployment." },
      { status: 503 }
    );
  }

  try {
    const body = (await req.json()) as {
      asset?: string;
      total?: string;
      cards?: number;
      message?: string;
      creator?: string;
    };

    const rawAsset = (body.asset || "USDC").trim();
    const asset = (rawAsset.toUpperCase() === "ETH" ? "ETH" : rawAsset.toUpperCase() === "USDC" ? "USDC" : rawAsset) as VoucherAsset;
    if (asset !== "USDC" && asset !== "ETH" && !isStockAsset(asset)) {
      return NextResponse.json({ error: "asset must be USDC, ETH, or a supported stock (e.g. NVDAc, AAPLc, TSLAc)" }, { status: 400 });
    }

    if (isStockAsset(asset)) {
      const killSwitch = await fetchRemoteKillSwitch();
      if (killSwitch) {
        return NextResponse.json(
          { error: "Tokenized stock features are temporarily paused via safety kill switch." },
          { status: 403 }
        );
      }
      if (!complianceConfig.features["stocks.vouchers"]) {
        return NextResponse.json(
          { error: "Tokenized stock voucher creation is currently disabled." },
          { status: 403 }
        );
      }
      const country =
        req.headers.get("x-vercel-ip-country") ||
        req.headers.get("cf-ipcountry") ||
        req.headers.get("x-user-country") ||
        null;
      const regionEvaluation = evaluateRegionCompliance(country, "stocks.vouchers");
      if (regionEvaluation.isRestricted && !regionEvaluation.canEnter) {
        return NextResponse.json(
          { error: "Tokenized stock features are not available in your region" },
          { status: 403 }
        );
      }
    }


    const total = body.total?.trim() || "";
    const cards = Number(body.cards);
    const message = body.message?.trim() || "";
    const creator = body.creator?.trim() as `0x${string}` | undefined;

    if (!creator?.startsWith("0x") || creator.length !== 42) {
      return NextResponse.json(
        { error: "creator wallet address is required" },
        { status: 400 }
      );
    }
    if (!total) {
      return NextResponse.json({ error: "total is required" }, { status: 400 });
    }
    if (!Number.isFinite(cards) || cards < 1 || cards > MAX_VOUCHER_CARDS) {
      return NextResponse.json(
        { error: `cards must be 1–${MAX_VOUCHER_CARDS}` },
        { status: 400 }
      );
    }

    const result = await prepareCreateBatch({
      asset,
      total,
      cards,
      message,
      creator,
    });

    return NextResponse.json(
      {
        ...result,
        credentialsSaved: Boolean(result.credentialsSaved),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[voucher/prepare-create POST]", err);
    return NextResponse.json({ error: "Failed to prepare create batch" }, { status: 500 });
  }
}
