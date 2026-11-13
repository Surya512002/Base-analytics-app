import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import { CAMPAIGN_TICKET_TTL_SEC, isCampaignGated } from "@/lib/voucher/campaign";
import {
  campaignContractReady,
  countryFromRequest,
  evaluateClaimEligibility,
  getClaimSigner,
  readCampaignOnchain,
  signClaimTicket,
} from "@/lib/voucher/campaign-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/voucher/campaign/:id/ticket   { claimer: "0x…" }
 *
 * Issues a short-lived claim ticket for campaigns created in "verified claims" mode.
 * The contract only releases funds to the wallet the ticket names, so a ticket can't be
 * replayed by someone else. Checks (in order): rate limits, campaign state, kill switch and
 * region rules for tokenized stocks, then one-claim-per-wallet.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d{1,12}$/.test(id)) {
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
  }
  if (!campaignContractReady() || !getClaimSigner()) {
    return NextResponse.json({ error: "Verified claims are not available on this deployment." }, { status: 503 });
  }

  // Rate limits only ever charge identities the caller actually controls. The claimer address in
  // the body is unauthenticated, so it is never used as a rate-limit key (anyone could otherwise
  // burn a victim wallet's quota). Order: requester IP → input validation → campaign exists →
  // per-campaign quota.
  const ip = getClientIp(req);
  const perIp = await checkRateLimitAsync(`campaign-ticket-ip:${ip}`, 12, 10 * 60_000);
  if (!perIp.ok) return rateLimitResponse(perIp.retryAfterSec);

  let claimer: string | undefined;
  try {
    const body = (await req.json()) as { claimer?: string };
    claimer = body.claimer?.trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!claimer || !isAddress(claimer)) {
    return NextResponse.json({ error: "claimer must be a valid address" }, { status: 400 });
  }

  try {
    const campaignId = BigInt(id);
    const onchain = await readCampaignOnchain(campaignId);
    if (!onchain) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    const { campaign } = onchain;

    const perCampaign = await checkRateLimitAsync(`campaign-ticket-campaign:${id}`, 600, 60_000);
    if (!perCampaign.ok) return rateLimitResponse(perCampaign.retryAfterSec);

    if (!isCampaignGated(campaign)) {
      return NextResponse.json({ error: "This campaign does not use claim tickets." }, { status: 400 });
    }
    if (campaign.claimSigner.toLowerCase() !== getClaimSigner()!.address.toLowerCase()) {
      return NextResponse.json({ error: "This campaign was created for a different verifier." }, { status: 400 });
    }
    // Same checks the recipient saw up front (eligibility endpoint) — enforced here.
    const elig = await evaluateClaimEligibility({
      campaignId,
      campaign,
      claimer: claimer as `0x${string}`,
      country: countryFromRequest(req),
    });
    if (!elig.eligible) {
      const failed = elig.checks.find((c) => c.result === "fail");
      const code = failed?.id === "campaign" || failed?.id === "already" ? 409 : failed?.id === "self" ? 400 : 403;
      return NextResponse.json({ error: elig.reason, check: failed?.id, checks: elig.checks }, { status: code });
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + CAMPAIGN_TICKET_TTL_SEC);
    const ticket = await signClaimTicket({
      campaignId,
      claimer: claimer as `0x${string}`,
      deadline,
    });
    if (!ticket) {
      return NextResponse.json({ error: "Could not issue ticket" }, { status: 503 });
    }
    return NextResponse.json(
      { ticket, deadline: deadline.toString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[voucher/campaign ticket]", err);
    return NextResponse.json({ error: "Could not issue ticket" }, { status: 502 });
  }
}
