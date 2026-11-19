import { NextResponse } from "next/server";
import type { VoucherBatchMeta } from "@/lib/types/voucher";
import {
  listCreatorBatches,
  readBatchDetail,
  readOnchainBatch,
  recoverBatchForWallet,
} from "@/lib/voucher/batch-read";
import { readStoredBatches, writeStoredBatches } from "@/lib/voucher/batch-store";
import { VOUCHER_CONTRACT, BASE_RPC } from "@/lib/constants/env";
import { isKnownVoucherContract } from "@/lib/voucher/voucher-contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const creator = searchParams.get("creator")?.toLowerCase();
    const batchId = searchParams.get("batchId");
    const tx = searchParams.get("tx")?.trim();
    const live = searchParams.get("live") === "1" || searchParams.get("live") === "true";

    if (creator && tx && live && VOUCHER_CONTRACT && BASE_RPC) {
      const batch = await recoverBatchForWallet(tx, creator);
      if (!batch) {
        return NextResponse.json({ recovered: false, batch: null });
      }
      return NextResponse.json({
        recovered: true,
        batch,
      });
    }

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
        const contractParam = searchParams.get("contract")?.toLowerCase();
        const detail = await readBatchDetail(id, isKnownVoucherContract(contractParam) ? contractParam : undefined);
        if (!detail.batch) {
          return NextResponse.json({ batch: null, cards: [] });
        }
        return NextResponse.json(detail);
      }

      const all = await readStoredBatches();
      const contractParam = searchParams.get("contract")?.toLowerCase();
      const batch =
        all.find((b) => b.batchId === id && (!contractParam || b.contractAddress === contractParam)) ?? null;
      return NextResponse.json({ batch });
    }

    // Do not leak other creators' batches when creator query param is omitted
    return NextResponse.json({ batches: [] });
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

    // Verify batch exists onchain before persisting meta. Ids repeat across contracts, so pick
    // the batch on the given contract (if any) that belongs to this creator.
    const contractHint = isKnownVoucherContract(body.contractAddress?.toLowerCase())
      ? (body.contractAddress!.toLowerCase() as `0x${string}`)
      : undefined;
    const live = await readOnchainBatch(body.batchId, contractHint, body.creator);
    if (!live || live.creator.toLowerCase() !== body.creator.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Batch not confirmed onchain for this creator" },
        { status: 400 }
      );
    }

    const all = await readStoredBatches();
    const liveContract = live.contractAddress?.toLowerCase();
    let idx = all.findIndex((b) => b.batchId === live.batchId && b.contractAddress === liveContract);
    if (idx < 0) idx = all.findIndex((b) => b.batchId === live.batchId && !b.contractAddress && b.creator.toLowerCase() === live.creator);
    // Store what the chain says, not what the caller sent: anyone can call this endpoint, so
    // client fields (message, amounts, counts…) must not overwrite a creator's batch.
    const txHash = typeof body.txHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(body.txHash) ? body.txHash : undefined;
    const createdAt = Number.isFinite(body.createdAt) && body.createdAt > 0 && body.createdAt <= Date.now() + 60_000 ? body.createdAt : Date.now();
    const entry: VoucherBatchMeta = {
      batchId: live.batchId,
      creator: live.creator,
      asset: live.asset,
      totalAmount: live.totalAmount,
      amountPerCard: live.amountPerCard,
      cardCount: live.cardCount,
      message: live.message,
      redeemedCount: live.redeemedCount,
      createdAt: idx >= 0 ? all[idx].createdAt : createdAt,
      txHash: txHash ?? (idx >= 0 ? all[idx].txHash : undefined),
      contractAddress: liveContract,
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
    const { batchId, contractAddress } = (await req.json()) as { batchId: number; contractAddress?: string };
    if (!Number.isInteger(batchId) || batchId <= 0) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const all = await readStoredBatches();
    const wanted = contractAddress?.toLowerCase();
    const idx = all.findIndex(
      (b) => b.batchId === batchId && (!wanted || !b.contractAddress || b.contractAddress === wanted)
    );
    if (idx < 0) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    // Refresh from the contract; the caller's number is ignored.
    const entry = all[idx]!;
    const live = await readOnchainBatch(
      batchId,
      isKnownVoucherContract(entry.contractAddress) ? entry.contractAddress : undefined,
      entry.creator
    );
    if (!live) return NextResponse.json({ success: false, error: "Not found onchain" }, { status: 404 });
    all[idx].contractAddress = live.contractAddress;
    all[idx].redeemedCount = live.redeemedCount;
    await writeStoredBatches(all);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Voucher PATCH]", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
