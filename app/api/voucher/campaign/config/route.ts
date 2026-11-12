import { NextResponse } from "next/server";
import { CAMPAIGN_CONTRACT } from "@/lib/constants/env";
import { getClaimSigner } from "@/lib/voucher/campaign-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/voucher/campaign/config — public: contract + (public) claim-ticket signer address. */
export async function GET() {
  const signer = getClaimSigner();
  return NextResponse.json(
    {
      ready: Boolean(CAMPAIGN_CONTRACT),
      contract: CAMPAIGN_CONTRACT || null,
      claimSigner: signer?.address ?? null,
      verifiedClaimsAvailable: Boolean(signer && CAMPAIGN_CONTRACT),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
