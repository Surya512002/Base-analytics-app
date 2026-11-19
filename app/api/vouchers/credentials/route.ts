import { NextResponse } from "next/server";
import type { StoredVoucherBatch } from "@/lib/utils/voucher";
import {
  readCreatorCredentials,
  upsertCreatorBatch,
} from "@/lib/voucher/credentials-store";
import { readOnchainBatches } from "@/lib/voucher/batch-read";
import { verifyBatchCredentials } from "@/lib/voucher/verify-credentials";
import { requireSiweSession } from "@/lib/auth/siwe-session";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const isAddress = (a: string | undefined): a is string => Boolean(a && /^0x[0-9a-f]{40}$/.test(a));

/**
 * GET /api/vouchers/credentials?creator=0x…
 * Saved card secrets for the signed-in creator. Only batches confirmed onchain for that
 * creator are returned, each tagged with the contract it lives on.
 */
export async function GET(req: Request) {
  try {
    const creator = new URL(req.url).searchParams.get("creator")?.toLowerCase();
    if (!isAddress(creator)) {
      return NextResponse.json({ error: "Invalid creator address" }, { status: 400 });
    }

    const session = await requireSiweSession(creator);
    if (!session.ok) {
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

    const stored = await readCreatorCredentials(creator);
    // One multicall for all saved batches. Ids repeat across contracts, so a record is kept
    // only if a batch with that id on its contract (or, for old records, any contract) is this creator's.
    const live = (
      await readOnchainBatches(stored.map((b) => ({ batchId: b.batchId, contract: b.contractAddress })))
    ).filter((l) => l.creator === creator);

    const batches: StoredVoucherBatch[] = [];
    for (const b of stored) {
      const own = live.filter(
        (l) =>
          l.batchId === b.batchId &&
          (!b.contractAddress || l.contractAddress === b.contractAddress.toLowerCase())
      );
      if (own.length === 0) continue;
      // Fill in the contract for old records when it's unambiguous.
      const contractAddress = b.contractAddress ?? (own.length === 1 ? own[0]!.contractAddress : undefined);
      batches.push({ ...b, contractAddress });
    }
    return NextResponse.json({ creator, batches, authenticated: true });
  } catch (err) {
    console.error("[Voucher credentials GET]", err);
    return NextResponse.json({ creator: null, batches: [] });
  }
}

/**
 * POST /api/vouchers/credentials { creator, batch }
 * Save card secrets for a batch. Requires a SIWE session for `creator`, and every secret must
 * hash to the hash stored onchain for its card, so saved links can't be tampered with.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const perIp = await checkRateLimitAsync(`voucher-credentials-ip:${ip}`, 30, 10 * 60_000);
    if (!perIp.ok) return rateLimitResponse(perIp.retryAfterSec);

    const body = (await req.json().catch(() => null)) as {
      creator?: string;
      batch?: StoredVoucherBatch;
    } | null;

    const creator = body?.creator?.toLowerCase();
    const batch = body?.batch;

    if (!isAddress(creator)) {
      return NextResponse.json({ success: false, error: "Invalid creator" }, { status: 400 });
    }
    if (!batch?.batchId || !Array.isArray(batch.cards)) {
      return NextResponse.json({ success: false, error: "Invalid batch" }, { status: 400 });
    }

    const session = await requireSiweSession(creator);
    if (!session.ok) {
      return NextResponse.json(
        { success: false, error: session.error, requiresAuth: true },
        { status: session.status }
      );
    }

    const check = await verifyBatchCredentials({ ...batch, creator }, creator);
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.reason }, { status: 400 });
    }

    await upsertCreatorBatch(creator, {
      ...batch,
      creator,
      contractAddress: check.contract.toLowerCase(),
    });
    return NextResponse.json({ success: true, contractAddress: check.contract.toLowerCase() });
  } catch (err) {
    console.error("[Voucher credentials POST]", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
