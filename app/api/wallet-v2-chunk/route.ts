import { NextResponse } from "next/server";
import {
  decodeV2Cursor,
  fetchBlockscoutV2Chunk,
  V2_STREAMS,
  type V2Stream,
} from "@/lib/api/blockscout-v2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.trim().toLowerCase();
  const stream = searchParams.get("stream") as V2Stream | null;
  const cursorRaw = searchParams.get("cursor");
  const pages = Math.min(
    25,
    Math.max(1, parseInt(searchParams.get("pages") || "15", 10) || 15)
  );

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  if (!stream || !V2_STREAMS.includes(stream)) {
    return NextResponse.json({ error: "Invalid stream" }, { status: 400 });
  }

  const cursor = cursorRaw ? decodeV2Cursor(cursorRaw) : null;

  try {
    const chunk = await fetchBlockscoutV2Chunk(
      address,
      stream,
      cursor,
      pages
    );
    return NextResponse.json(chunk);
  } catch (err) {
    console.error("[wallet-v2-chunk]", err);
    return NextResponse.json({ error: "Chunk fetch failed" }, { status: 500 });
  }
}
