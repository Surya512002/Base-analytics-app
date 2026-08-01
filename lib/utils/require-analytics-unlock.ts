import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ANALYTICS_UNLOCK_COOKIE,
  isAnalyticsUnlockedServer,
} from "@/lib/utils/analytics-unlock-server";

/** Require paid onchain-analytics unlock before Alchemy / full history APIs run. */
export async function requireAnalyticsUnlock(
  req: Request | NextRequest,
  address: string
): Promise<NextResponse | null> {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${ANALYTICS_UNLOCK_COOKIE}=([^;]+)`)
  );
  const cookieToken = match?.[1] ? decodeURIComponent(match[1]) : null;
  const headerToken = req.headers.get("x-analytics-unlock");
  const unlocked =
    (await isAnalyticsUnlockedServer(address, cookieToken)) ||
    (await isAnalyticsUnlockedServer(address, headerToken));
  if (unlocked) return null;
  return NextResponse.json(
    {
      error: "Analytics unlock required",
      code: "ANALYTICS_LOCKED",
      message:
        "Pay to unlock full onchain analysis before wallet history is collected via Alchemy.",
    },
    { status: 402 }
  );
}
