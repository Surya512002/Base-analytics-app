import { NextResponse } from "next/server";
import { CAMPAIGN_CONTRACT } from "@/lib/constants/env";
import { CAMPAIGN_ABI } from "@/lib/voucher/campaign-abi";
import { V2_MAX_CLAIMS } from "@/lib/voucher/campaign-contracts";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { getClaimSigner } from "@/lib/voucher/campaign-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MAX_CLAIMS of the contract new gifts go to (1,000 on v2, 1,000,000 on v3). It's a contract
 *  constant, so it's read once per server instance. */
let maxClaimsCache: { contract: string; value: number } | null = null;
async function maxClaimsFor(contract: `0x${string}`): Promise<number> {
  if (maxClaimsCache?.contract === contract) return maxClaimsCache.value;
  try {
    const v = (await createBasePublicClient().readContract({ address: contract, abi: CAMPAIGN_ABI, functionName: "MAX_CLAIMS" })) as bigint;
    const value = Number(v) > 0 ? Number(v) : V2_MAX_CLAIMS;
    maxClaimsCache = { contract, value };
    return value;
  } catch {
    return V2_MAX_CLAIMS; // safe default: the smaller v2 cap
  }
}

/** GET /api/voucher/campaign/config — public: contract, its claim cap, (public) claim-ticket signer address. */
export async function GET() {
  const signer = getClaimSigner();
  const maxClaims = CAMPAIGN_CONTRACT ? await maxClaimsFor(CAMPAIGN_CONTRACT) : V2_MAX_CLAIMS;
  return NextResponse.json(
    {
      ready: Boolean(CAMPAIGN_CONTRACT),
      contract: CAMPAIGN_CONTRACT || null,
      maxClaims,
      claimSigner: signer?.address ?? null,
      verifiedClaimsAvailable: Boolean(signer && CAMPAIGN_CONTRACT),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
