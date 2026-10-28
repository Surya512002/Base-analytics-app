/**
 * Tokenized Stock Compliance & Jurisdiction Configuration
 *
 * Configurable, neutral compliance parameters for tokenized equity trading on Base.
 * NOTE: The exact compliance wording and any geo-restriction enforcement rules
 * require formal review and approval by qualified legal counsel.
 */

export interface StockComplianceConfig {
  /** Canonical link to issuer terms of service */
  issuerTermsUrl: string;
  /** Short, neutral compliance statement */
  neutralNotice: string;
  /** Explanatory note regarding 24/7 AMM trading vs 24/5 equity market hours */
  marketHoursNotice: string;
  /** Whether optional geo-blocking is enforced */
  geoBlockEnabled: boolean;
  /** List of ISO 3166-1 alpha-2 restricted region codes */
  restrictedRegions: string[];
}

export const DEFAULT_STOCK_COMPLIANCE: StockComplianceConfig = {
  issuerTermsUrl: "https://www.coinbase.com/legal/tokenized-stocks",
  neutralNotice:
    "Availability of tokenized stocks may depend on your location and the issuer's terms. Check the issuer's terms before trading.",
  marketHoursNotice:
    "US equity exchanges operate 24/5; tokenized stocks trade 24/7 on Base AMMs with live pool pricing.",
  geoBlockEnabled: process.env.NEXT_PUBLIC_ENABLE_GEO_BLOCK === "true",
  restrictedRegions: (
    process.env.NEXT_PUBLIC_RESTRICTED_REGIONS || "US,CU,IR,KP,SY"
  )
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean),
};

/**
 * Checks whether a user's region is subject to configured restriction policy.
 * Non-blocking by default unless geoBlockEnabled is explicitly configured true.
 */
export function checkJurisdictionEligibility(userRegion?: string | null): {
  isRestricted: boolean;
  shouldBlock: boolean;
  region: string | null;
  notice: string;
} {
  const region = userRegion?.trim().toUpperCase() || null;
  const isRestricted = region
    ? DEFAULT_STOCK_COMPLIANCE.restrictedRegions.includes(region)
    : false;

  const shouldBlock = DEFAULT_STOCK_COMPLIANCE.geoBlockEnabled && isRestricted;

  return {
    isRestricted,
    shouldBlock,
    region,
    notice: DEFAULT_STOCK_COMPLIANCE.neutralNotice,
  };
}
