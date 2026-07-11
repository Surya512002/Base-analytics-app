import { NextResponse } from "next/server";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import { fetchUserPinStatus } from "@/lib/base/notifications-client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimitAsync(`pin-status:${ip}`, 60, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.trim().toLowerCase();

  if (!address || !/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  if (!process.env.BASE_DASHBOARD_API_KEY?.trim()) {
    return NextResponse.json({
      appPinned: false,
      notificationsEnabled: false,
      configured: false,
    });
  }

  try {
    const status = await fetchUserPinStatus(address);
    return NextResponse.json({ ...status, configured: true });
  } catch (e) {
    console.error("[base-app/pin-status]", e);
    return NextResponse.json({
      appPinned: false,
      notificationsEnabled: false,
      configured: true,
      error: "Status unavailable",
    });
  }
}
