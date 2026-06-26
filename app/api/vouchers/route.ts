import { NextResponse } from "next/server";
import { Redis } from "ioredis";
import type { VoucherBatchMeta } from "@/lib/types/voucher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DB_KEY = "base_voucher_batches";

function createRedis(): Redis {
  const url = process.env.KV_REDIS_URL;
  if (!url) throw new Error("KV_REDIS_URL not set");
  const client = new Redis(url, {
    tls: url.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 8000,
    commandTimeout: 5000,
    enableReadyCheck: false,
  });
  client.on("error", (e) => console.error("[Voucher Redis]", e.message));
  return client;
}

async function readAll(): Promise<VoucherBatchMeta[]> {
  let redis: Redis | null = null;
  try {
    redis = createRedis();
    await redis.connect();
    const raw = await redis.get(DB_KEY);
    return raw ? (JSON.parse(raw) as VoucherBatchMeta[]) : [];
  } finally {
    if (redis) try { await redis.quit(); } catch { redis.disconnect(); }
  }
}

async function writeAll(batches: VoucherBatchMeta[]): Promise<void> {
  let redis: Redis | null = null;
  try {
    redis = createRedis();
    await redis.connect();
    await redis.set(DB_KEY, JSON.stringify(batches));
  } finally {
    if (redis) try { await redis.quit(); } catch { redis.disconnect(); }
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const creator = searchParams.get("creator")?.toLowerCase();
    const batchId = searchParams.get("batchId");

    const all = await readAll();

    if (batchId) {
      const id = parseInt(batchId, 10);
      const batch = all.find((b) => b.batchId === id);
      return NextResponse.json({ batch: batch || null });
    }

    const filtered = creator
      ? all.filter((b) => b.creator.toLowerCase() === creator)
      : all;

    return NextResponse.json({ batches: filtered });
  } catch (err) {
    console.error("[Voucher GET]", err);
    return NextResponse.json({ batches: [] });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as VoucherBatchMeta;
    if (!body.creator?.startsWith("0x") || !body.batchId) {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    const all = await readAll();
    const idx = all.findIndex((b) => b.batchId === body.batchId);
    const entry: VoucherBatchMeta = {
      ...body,
      creator: body.creator.toLowerCase(),
      redeemedCount: body.redeemedCount ?? 0,
    };
    if (idx >= 0) all[idx] = { ...all[idx], ...entry };
    else all.unshift(entry);

    await writeAll(all);
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

    const all = await readAll();
    const idx = all.findIndex((b) => b.batchId === batchId);
    if (idx < 0) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    all[idx].redeemedCount = redeemedCount;
    await writeAll(all);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Voucher PATCH]", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
