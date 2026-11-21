import { NextResponse } from "next/server";
import {
  getLaunchedToken,
  listLaunchedTokens,
  registerLaunchedToken,
} from "@/lib/launchpad/token-store";
import { isB20AssetActivated } from "@/lib/b20/activation";
import { isInvalidLaunchTokenAddress, launchReceiptError } from "@/lib/b20/launch-receipt";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { limitByIp } from "@/lib/api/rate-limit";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { scheduleLaunchNotification } from "@/lib/launchpad/launch-notify";
import { requireSiweSession } from "@/lib/auth/siwe-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const tokens = await listLaunchedTokens();
  let b20Activated = true;
  try {
    b20Activated = await isB20AssetActivated();
  } catch (e) {
    console.warn("[launchpad/tokens] B20 activation check failed", e);
  }
  return NextResponse.json({
    tokens,
    b20Activated,
    count: tokens.length,
  });
}

export async function POST(req: Request) {
  const limited = await limitByIp(req, "launchpad-tokens-post", 20);
  if (limited) return limited;
  try {
    const body = (await req.json()) as Partial<LaunchedToken>;
    const address = body.address?.trim();
    const name = body.name?.trim();
    const symbol = body.symbol?.trim();
    const creator = body.creator?.trim()?.toLowerCase();
    const txHash = body.txHash?.trim();

    if (
      !address ||
      !address.startsWith("0x") ||
      address.length !== 42 ||
      isInvalidLaunchTokenAddress(address) ||
      !name ||
      !symbol ||
      !creator ||
      !creator.startsWith("0x") ||
      creator.length !== 42 ||
      !txHash
    ) {
      return NextResponse.json({ error: "Invalid token payload" }, { status: 400 });
    }

    const session = await requireSiweSession(creator);
    if (!session.ok) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }

    // The tx must really be this creator's launch of this token, or anyone signed in could claim any token's fees.
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return NextResponse.json({ error: "Invalid launch transaction" }, { status: 400 });
    }
    const receipt = await createBasePublicClient()
      .getTransactionReceipt({ hash: txHash as `0x${string}` })
      .catch(() => null);
    const bad = receipt ? launchReceiptError(receipt, address, creator) : "Launch transaction not found yet";
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });

    // Prevent fee hijack: existing registry creator cannot be overwritten by another wallet.
    const existing = await getLaunchedToken(address);
    if (
      existing?.creator &&
      existing.creator !== creator &&
      existing.creator.startsWith("0x")
    ) {
      return NextResponse.json(
        { error: "Token already registered to another creator" },
        { status: 409 }
      );
    }

    const decimals =
      typeof body.decimals === "number" && body.decimals >= 6 && body.decimals <= 18
        ? body.decimals
        : 18;

    const tokens = await registerLaunchedToken({
      address,
      name,
      symbol,
      decimals,
      creator,
      txHash,
      imageUrl: body.imageUrl?.trim() || undefined,
      description: body.description?.trim() || undefined,
      website: body.website?.trim() || undefined,
      twitter: body.twitter?.trim() || undefined,
      telegram: body.telegram?.trim() || undefined,
      discord: body.discord?.trim() || undefined,
      createdAt: body.createdAt ?? Date.now(),
      supplyCap: body.supplyCap,
      launchPreset: body.launchPreset?.trim() || undefined,
      vestingSchedule: body.vestingSchedule,
      launchBlock: typeof body.launchBlock === "number" ? body.launchBlock : undefined,
      antiSnipeBlocks:
        typeof body.antiSnipeBlocks === "number" && body.antiSnipeBlocks >= 0
          ? body.antiSnipeBlocks
          : undefined,
      poolOpenBlock:
        typeof body.poolOpenBlock === "number"
          ? body.poolOpenBlock
          : typeof body.launchBlock === "number"
            ? body.launchBlock
            : undefined,
      startPriceUsd: body.startPriceUsd?.trim() || undefined,
      source: body.source ?? "launched",
    });

    scheduleLaunchNotification({ symbol, name, address });

    return NextResponse.json({ ok: true, tokens });
  } catch (err) {
    console.error("[launchpad/tokens POST]", err);
    return NextResponse.json({ error: "Failed to register token" }, { status: 500 });
  }
}
