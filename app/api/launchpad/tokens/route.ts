import { NextResponse } from "next/server";
import {
  listLaunchedTokens,
  registerLaunchedToken,
} from "@/lib/launchpad/token-store";
import { isB20AssetActivated } from "@/lib/b20/activation";
import type { LaunchedToken } from "@/lib/launchpad/types";

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
    const creator = body.creator?.trim();
    const txHash = body.txHash?.trim();

    if (
      !address ||
      !address.startsWith("0x") ||
      address.length !== 42 ||
      !name ||
      !symbol ||
      !creator ||
      !txHash
    ) {
      return NextResponse.json({ error: "Invalid token payload" }, { status: 400 });
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
        typeof body.poolOpenBlock === "number" ? body.poolOpenBlock : undefined,
    });

    return NextResponse.json({ ok: true, tokens });
  } catch (err) {
    console.error("[launchpad/tokens POST]", err);
    return NextResponse.json({ error: "Failed to register token" }, { status: 500 });
  }
}
