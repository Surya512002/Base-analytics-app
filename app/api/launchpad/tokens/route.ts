import { NextResponse } from "next/server";
import {
  getLaunchedToken,
  listLaunchedTokens,
  registerLaunchedToken,
} from "@/lib/launchpad/token-store";
import { isB20AssetActivated } from "@/lib/b20/activation";
import { isInvalidLaunchTokenAddress } from "@/lib/b20/launch-receipt";
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
