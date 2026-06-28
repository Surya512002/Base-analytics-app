import { NextResponse } from "next/server";
import type { VoucherBatchMeta } from "@/lib/types/voucher";
import {
  listCreatorBatches,
  readBatchDetail,
} from "@/lib/voucher/batch-read";
import { readStoredBatches, writeStoredBatches } from "@/lib/voucher/batch-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const creator = searchParams.get("creator")?.toLowerCase();
    const batchId = searchParams.get("batchId");
    const live = searchParams.get("live") === "1" || searchParams.get("live") === "true";

    if (creator) {
      if (live) {
        const summary = await listCreatorBatches(creator);
        return NextResponse.json(summary);
      }

      const all = await readStoredBatches();
      const filtered = all.filter((b) => b.creator.toLowerCase() === creator);
      return NextResponse.json({ batches: filtered });
    }

    if (batchId) {
      const id = parseInt(batchId, 10);
      if (!Number.isFinite(id) || id < 1) {
        return NextResponse.json({ error: "Invalid batchId" }, { status: 400 });
      }

      if (live) {
        const detail = await readBatchDetail(id);
        if (!detail.batch) {
          return NextResponse.json({ batch: null, cards: [] });
        }
        return NextResponse.json(detail);
      }

      const all = await readStoredBatches();
      const batch = all.find((b) => b.batchId === id) ?? null;
      return NextResponse.json({ batch });
    }

    const all = await readStoredBatches();
    return NextResponse.json({ batches: all });
  } catch (err) {
    console.error("[Voucher GET]", err);
    return NextResponse.json({ batches: [], batch: null });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as VoucherBatchMeta;
    if (!body.creator?.startsWith("0x") || !body.batchId) {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    const all = await readStoredBatches();
    const idx = all.findIndex((b) => b.batchId === body.batchId);
    const entry: VoucherBatchMeta = {
      ...body,
      creator: body.creator.toLowerCase(),
      redeemedCount: body.redeemedCount ?? 0,
    };
    if (idx >= 0) all[idx] = { ...all[idx], ...entry };
    else all.unshift(entry);

    await writeStoredBatches(all);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Voucher POST]", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { batchId, redeemedCount } = (await req.json()) as {
      batchId: number;
      redeemedCount: number;
    };
    if (!batchId) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const all = await readStoredBatches();
    const idx = all.findIndex((b) => b.batchId === batchId);
    if (idx < 0) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    all[idx].redeemedCount = redeemedCount;
    await writeStoredBatches(all);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Voucher PATCH]", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
