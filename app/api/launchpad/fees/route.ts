import { NextResponse } from "next/server";
import {
  getCreatorRevenue,
  getReferrerRevenue,
  recordFeeEvent,
  type FeeAsset,
} from "@/lib/launchpad/fee-ledger";
import { LAUNCHPAD_PLATFORM_FEE_BPS } from "@/lib/constants/launchpad";
import {
  FEE_SHARE_CREATOR_BPS,
  FEE_SHARE_PLATFORM_BPS,
  FEE_SHARE_REFERRER_BPS,
  feeShareLabels,
  splitPlatformFee,
} from "@/lib/launchpad/fee-split";
import { listLaunchedTokens } from "@/lib/launchpad/token-store";
import { requireSiweSession } from "@/lib/auth/siwe-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const creator = searchParams.get("creator")?.trim().toLowerCase();
  const referrer = searchParams.get("referrer")?.trim().toLowerCase();

  if (!creator && !referrer) {
    return NextResponse.json(
      {
        platformFeeBps: LAUNCHPAD_PLATFORM_FEE_BPS,
        feeShares: feeShareLabels(),
        creatorBps: FEE_SHARE_CREATOR_BPS,
        platformBps: FEE_SHARE_PLATFORM_BPS,
        referrerBps: FEE_SHARE_REFERRER_BPS,
      },
      { status: 200 }
    );
  }

  const addr = creator ?? referrer!;
  const isCreator = Boolean(creator);
  let summary = isCreator
    ? await getCreatorRevenue(addr)
    : await getReferrerRevenue(addr);

  if (summary.eventCount === 0 && isCreator) {
    const tokens = await listLaunchedTokens();
    const mine = tokens.filter((t) => t.creator === addr);
    if (mine.length > 0) {
      summary = { ...summary, estimated: true };
    }
  }

  return NextResponse.json({ summary });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const txHash = String(body.txHash ?? "").trim();
    const tokenAddress = String(body.tokenAddress ?? "").trim().toLowerCase();
    const tokenSymbol = String(body.tokenSymbol ?? "").trim();
    const trader = String(body.trader ?? "").trim().toLowerCase();
    const creator = String(body.creator ?? "").trim().toLowerCase();
    const direction = body.direction === "sell" ? "sell" : "buy";
    const feeAsset = (["eth", "usdc", "token"].includes(String(body.feeAsset))
      ? body.feeAsset
      : "eth") as FeeAsset;

    if (
      !txHash.startsWith("0x") ||
      !tokenAddress.startsWith("0x") ||
      tokenAddress.length !== 42 ||
      !trader.startsWith("0x") ||
      trader.length !== 42 ||
      !creator.startsWith("0x") ||
      creator.length !== 42
    ) {
      return NextResponse.json({ error: "Invalid fee event" }, { status: 400 });
    }

    const session = await requireSiweSession(trader);
    if (!session.ok) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }

    const referrerRaw = body.referrer ? String(body.referrer).trim().toLowerCase() : null;
    const referrer =
      referrerRaw?.startsWith("0x") && referrerRaw.length === 42 ? referrerRaw : null;

    const feeAmount = BigInt(String(body.feeAmount ?? "0"));
    const split = splitPlatformFee(feeAmount, {
      creator: creator as `0x${string}`,
      referrer: referrer as `0x${string}` | null,
    });

    // Match on-chain skipSelf: no creator transfer when trader is the creator.
    const creatorShare = trader === creator ? BigInt(0) : split.creator;
    const referrerShare =
      referrer && trader === referrer ? BigInt(0) : split.referrer;

    const event = await recordFeeEvent({
      txHash,
      tokenAddress,
      tokenSymbol: tokenSymbol || "TOKEN",
      trader,
      creator,
      referrer,
      direction,
      feeAsset,
      feeAmount: feeAmount.toString(),
      creatorShare: creatorShare.toString(),
      platformShare: split.platform.toString(),
      referrerShare: referrerShare.toString(),
    });

    return NextResponse.json({ ok: true, event });
  } catch (e) {
    console.warn("[launchpad/fees] record failed", e);
    return NextResponse.json({ error: "Failed to record fee" }, { status: 500 });
  }
}
