import { NextResponse, type NextRequest } from "next/server";
import { getComplianceConfig } from "@/src/config/compliance";
import { isLimitOrdersFeatureEnabled } from "@/src/lib/limitOrders/featureFlag";

export const dynamic = "force-dynamic";

/**
 * Region restriction check for Pro Orders / Tokenized Stock Limits.
 *
 * NOTE FOR COMPLIANCE & LEGAL REVIEW:
 * This is a client/UI-level safeguard based on server-evaluated geolocation headers.
 * The underlying on-chain smart contracts cannot enforce geography directly.
 * Reuses the central app compliance configuration (DEFAULT_RESTRICTED_REGIONS)
 * in addition to any custom LIMIT_ORDERS_BLOCKED_COUNTRIES.
 */
export async function GET(request: NextRequest) {
  // G5 Feature flag: check single source of truth
  if (!isLimitOrdersFeatureEnabled()) {
    return NextResponse.json(
      { error: "Limit orders feature is disabled." },
      { status: 404 }
    );
  }

  // 1. Read edge geolocation headers (Vercel IP country, fallbacks for proxies/tests)
  const countryHeader =
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-user-country") ||
    request.headers.get("x-mock-country") ||
    process.env.COMPLIANCE_MOCK_COUNTRY ||
    null;

  const country = countryHeader?.trim().toUpperCase() || null;

  // 2. Combine central app compliance country list with LIMIT_ORDERS_BLOCKED_COUNTRIES
  const compliance = getComplianceConfig();
  const complianceList = (compliance.defaultRestrictedRegions || []).map((c) =>
    c.toUpperCase()
  );

  const envBlockedList = (process.env.LIMIT_ORDERS_BLOCKED_COUNTRIES || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  const blockedSet = new Set(["US", ...complianceList, ...envBlockedList]);

  // 3. Determine if restricted:
  // - In production: a missing header counts as restricted for safety.
  // - In development/test: a missing header is allowed.
  const isProduction = process.env.NODE_ENV === "production";
  let isRestricted = false;
  let reason: string | null = null;

  if (!country) {
    if (isProduction) {
      isRestricted = true;
      reason = "Country could not be verified in production environment.";
    } else {
      isRestricted = false;
    }
  } else if (blockedSet.has(country)) {
    isRestricted = true;
    reason = `Orders are restricted in region: ${country}.`;
  }

  return NextResponse.json({
    restricted: isRestricted,
    country: country,
    message: isRestricted
      ? "These orders aren't available in your region."
      : "Allowed",
    reason,
  });
}
