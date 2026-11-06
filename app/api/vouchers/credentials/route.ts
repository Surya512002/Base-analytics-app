import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { StoredVoucherBatch } from "@/lib/utils/voucher";
import {
  readCreatorCredentials,
  upsertCreatorBatch,
} from "@/lib/voucher/credentials-store";
import { readOnchainBatch } from "@/lib/voucher/batch-read";
import { parseSessionToken, SESSION_COOKIE } from "@/lib/auth/siwe-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const creator = new URL(req.url).searchParams.get("creator")?.toLowerCase();
    if (!creator?.startsWith("0x") || creator.length !== 42) {
      return NextResponse.json({ error: "Invalid creator address" }, { status: 400 });
    }

    // Creator authentication gate: verify user holds the private key of the creator
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    const sessionAddr = parseSessionToken(token);

    if (!sessionAddr || sessionAddr.toLowerCase() !== creator) {
      return NextResponse.json(
        {
          error: "Creator authentication required. Please sign in with your wallet to view claim keys.",
          requiresAuth: true,
          creator,
          batches: [],
        },
        { status: 401 }
      );
    }

    const batches = await readCreatorCredentials(creator);
    // Strict verification: only return credentials for batches confirmed onchain
    const confirmedBatches: StoredVoucherBatch[] = [];
    for (const b of batches) {
      const live = await readOnchainBatch(b.batchId);
      if (live && live.creator.toLowerCase() === creator) {
        confirmedBatches.push(b);
      }
    }
    return NextResponse.json({ creator, batches: confirmedBatches, authenticated: true });
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

    // Verify batch exists onchain and was created by this creator
    const live = await readOnchainBatch(batch.batchId);
    if (!live || live.creator.toLowerCase() !== creator) {
      return NextResponse.json(
        { success: false, error: "Batch not confirmed onchain for this creator" },
        { status: 400 }
      );
    }

    const hasSecrets = batch.cards.some((c) => c.secret?.trim());
    if (!hasSecrets) {
      return NextResponse.json({ success: false, error: "No card secrets" }, { status: 400 });
    }

    await upsertCreatorBatch(creator, { ...batch, creator });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Voucher credentials POST]", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
