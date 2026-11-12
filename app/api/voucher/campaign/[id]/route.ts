import { NextResponse } from "next/server";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import { campaignContractReady, readCampaignPublicView } from "@/lib/voucher/campaign-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/voucher/campaign/:id
 * Public, read-only campaign status + sender identity. Never returns or needs the secret.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d{1,12}$/.test(id)) {
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
  }
  if (!campaignContractReady()) {
    return NextResponse.json({ error: "Shared-link vouchers are not live on this deployment yet." }, { status: 503 });
  }

  const rl = await checkRateLimitAsync(`campaign-view:${getClientIp(req)}`, 120, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  try {
    const view = await readCampaignPublicView(BigInt(id));
    if (!view) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[voucher/campaign GET]", err);
    return NextResponse.json({ error: "Could not read campaign" }, { status: 502 });
  }
}
