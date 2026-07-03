import { NextResponse } from "next/server";
import type { StoredVoucherBatch } from "@/lib/utils/voucher";
import {
  readCreatorCredentials,
  upsertCreatorBatch,
} from "@/lib/voucher/credentials-store";
import { verifyBatchCredentials } from "@/lib/voucher/verify-credentials";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const creator = new URL(req.url).searchParams.get("creator")?.toLowerCase();
    if (!creator?.startsWith("0x") || creator.length !== 42) {
      return NextResponse.json({ error: "Invalid creator address" }, { status: 400 });
    }

    const batches = await readCreatorCredentials(creator);
    return NextResponse.json({ creator, batches });
  } catch (err) {
    console.error("[Voucher credentials GET]", err);
    return NextResponse.json({ creator: null, batches: [] });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      creator?: string;
      batch?: StoredVoucherBatch;
    };

    const creator = body.creator?.toLowerCase();
    const batch = body.batch;

    if (!creator?.startsWith("0x") || creator.length !== 42) {
      return NextResponse.json({ success: false, error: "Invalid creator" }, { status: 400 });
    }
    if (!batch?.batchId || !Array.isArray(batch.cards)) {
      return NextResponse.json({ success: false, error: "Invalid batch" }, { status: 400 });
    }

    const hasSecrets = batch.cards.some((c) => c.secret?.trim());
    if (!hasSecrets) {
      return NextResponse.json({ success: false, error: "No card secrets" }, { status: 400 });
    }

    const valid = await verifyBatchCredentials(batch, creator);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: "Secrets do not match on-chain batch for this wallet" },
        { status: 403 }
      );
    }

    await upsertCreatorBatch(creator, { ...batch, creator });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Voucher credentials POST]", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
