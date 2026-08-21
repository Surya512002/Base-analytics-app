import { NextResponse } from "next/server";
import { analyzeWalletAddress } from "@/lib/analyze-wallet";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import { logEnvAuditOnce } from "@/lib/env-audit";
import {
  getCachedAnalyze,
  isUsableAnalyzeCache,
  setCachedAnalyze,
} from "@/lib/wallet/analyze-cache";
import { requireAnalyticsUnlock } from "@/lib/utils/require-analytics-unlock";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ip = getClientIp(req);
  const refresh = searchParams.get("refresh") === "1";
  const limit = refresh ? 6 : 30;
  const rl = await checkRateLimitAsync(`analyze:${ip}`, limit, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const address = searchParams.get("address")?.trim().toLowerCase();
  const quick = searchParams.get("quick") === "1";
  const recent = searchParams.get("recent") === "1";
  const complete = searchParams.get("complete") === "1";

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    logEnvAuditOnce();

    // Full onchain analysis (incl. cached score shells) only after x402 unlock —
    // avoids serving paid history without payment and discourages free key usage.
    const locked = await requireAnalyticsUnlock(req, address);
    if (locked) return locked;

    if (!refresh) {
      const cached = await getCachedAnalyze(address);
      if (cached && isUsableAnalyzeCache(cached)) {
        return NextResponse.json({ ...cached, cached: true });
      }
    }

    const result = await analyzeWalletAddress(address, {
      fetchDepth: complete
        ? "complete"
        : quick
          ? "quick"
          : recent
            ? "recent"
            : "connect",
    });
    if (!result) {
      return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
    }

    // Recent is a last-activity preview only — never persist it as the score.
    if (!recent) {
      await setCachedAnalyze(address, result);
    }

    return NextResponse.json({ ...result, cached: false });
  } catch (err) {
    console.error("[analyze-wallet]", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
