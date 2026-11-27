import { NextResponse, type NextRequest } from "next/server";
import {
  getComplianceConfig,
  evaluateRegionCompliance,
  fetchRemoteKillSwitch,
} from "@/src/config/compliance";
import { trustedCountryFromHeaders } from "@/lib/compliance/request-country";

export const dynamic = "force-dynamic";

/**
 * GET /api/compliance/status
 *
 * Returns server-verified compliance status for the calling client based on
 * edge geolocation headers. Never trusts client-supplied geolocation parameters.
 */
export async function GET(request: NextRequest) {
  const country = trustedCountryFromHeaders(request.headers);

  // Check remote kill switch if configured
  const remoteKill = await fetchRemoteKillSwitch();
  const config = getComplianceConfig();
  if (remoteKill) {
    config.globalKillSwitch = true;
  }

  const evaluation = evaluateRegionCompliance(country, undefined, config);

  return NextResponse.json({
    country: country === "UNKNOWN" ? null : country,
    isRestricted: evaluation.isRestricted,
    mode: evaluation.mode,
    canEnter: evaluation.canEnter,
    canExit: evaluation.canExit,
    locationBlocked: evaluation.locationBlocked,
    globalKillSwitch: config.globalKillSwitch,
    features: config.features,
    notice:
      evaluation.isRestricted && !evaluation.canEnter
        ? "Tokenized stock features are not available in your region."
        : "Availability of tokenized stocks may depend on your location and the issuer's terms.",
    issuerTermsUrl: config.issuerTermsUrl,
    acknowledgementVersion: config.acknowledgementVersion,
  });
}
