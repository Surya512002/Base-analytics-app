import { NextResponse } from "next/server";
import { errorResponse, limitIp } from "@/lib/drops/http";
import { defaultDeps, feed } from "@/lib/drops/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/drops/feed?before=<id>&limit=24 → public drops (listed by their creators), newest first. */
export async function GET(req: Request) {
  const limited = await limitIp(req, "feed", 60, 60_000);
  if (limited) return limited;
  try {
    const url = new URL(req.url);
    const beforeRaw = url.searchParams.get("before");
    const before = beforeRaw && /^\d{10,20}$/.test(beforeRaw) ? BigInt(beforeRaw) : undefined;
    const limit = Number(url.searchParams.get("limit") ?? 24);
    return NextResponse.json(await feed(defaultDeps(), { before, limit: Number.isFinite(limit) ? limit : 24 }), {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
