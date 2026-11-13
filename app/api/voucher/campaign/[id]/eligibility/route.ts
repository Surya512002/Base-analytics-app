import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import {
  campaignContractReady,
  countryFromRequest,
  evaluateClaimEligibility,
  readCampaignOnchain,
} from "@/lib/voucher/campaign-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/voucher/campaign/:id/eligibility?wallet=0x…
 * Read-only pre-claim check shown to the recipient BEFORE they claim. Issues nothing.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d{1,12}$/.test(id)) return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
  if (!campaignContractReady()) {
    return NextResponse.json({ error: "Shared-link vouchers are not live on this deployment yet." }, { status: 503 });
  }
  const rl = await checkRateLimitAsync(`campaign-elig:${getClientIp(req)}`, 60, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const wallet = new URL(req.url).searchParams.get("wallet")?.trim() || null;
  if (wallet && !isAddress(wallet)) return NextResponse.json({ error: "wallet must be a valid address" }, { status: 400 });

  try {
    const onchain = await readCampaignOnchain(BigInt(id));
    if (!onchain) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    const result = await evaluateClaimEligibility({
      campaignId: BigInt(id),
      campaign: onchain.campaign,
      claimer: wallet as `0x${string}` | null,
      country: countryFromRequest(req),
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[voucher/campaign eligibility]", err);
    return NextResponse.json({ error: "Could not check eligibility" }, { status: 502 });
  }
}
