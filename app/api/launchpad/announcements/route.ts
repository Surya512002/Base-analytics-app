import { NextResponse } from "next/server";
import { addAnnouncement, listAnnouncements } from "@/lib/launchpad/announcements-store";
import { requireSiweSession } from "@/lib/auth/siwe-session";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "").trim().toLowerCase();
  if (!token.startsWith("0x") || token.length !== 42) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  const announcements = await listAnnouncements(token);
  return NextResponse.json({ announcements });
}

export async function POST(req: Request) {
  const rl = await checkRateLimitAsync(`launchpad-announce:${getClientIp(req)}`, 10, 10 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);
  try {
    const body = (await req.json()) as {
      token?: string;
      creator?: string;
      body?: string;
    };
    // The caller must BE the creator: a signed-in wallet session for that address, not just
    // an address in the request body (which anyone could type).
    const session = await requireSiweSession((body.creator || "").trim().toLowerCase());
    if (!session.ok) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }
    const result = await addAnnouncement(
      body.token || "",
      body.creator || "",
      body.body || ""
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }
    return NextResponse.json({ ok: true, announcements: result.announcements });
  } catch (e) {
    console.error("[launchpad/announcements POST]", e);
    return NextResponse.json({ error: "Failed to post" }, { status: 500 });
  }
}
