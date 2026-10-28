/**
 * Central Compliance Configuration for Tokenized Stocks (Base Mainnet)
 *
 * NOTE: These are product safeguards pending legal review, not legal advice.
 * The application must NEVER claim to be "compliant" or legally verified.
 */

export type ComplianceRegionMode = "full" | "exit-only" | "blocked";

export type ComplianceFeatureKey =
  | "stocks.swap"
  | "stocks.lend"
  | "stocks.launchPairs"
  | "stocks.vouchers";

export interface ComplianceFeatureFlags {
  /** Enables trading tokenized stocks via AMM pools */
  "stocks.swap": boolean;
  /** Enables lending and borrowing tokenized stock collateral */
  "stocks.lend": boolean;
  /** Enables token launches paired with tokenized stock assets */
  "stocks.launchPairs": boolean;
  /** Enables creation of crypto gift vouchers backed by tokenized stocks */
  "stocks.vouchers": boolean;
}

export interface ComplianceConfig {
  /** Global kill switch for all tokenized stock features (true = kill switch active, stock features disabled) */
  globalKillSwitch: boolean;
  /** Server-enforced feature flags */
  features: ComplianceFeatureFlags;
  /**
   * Default list of ISO 3166-1 alpha-2 country codes restricted from tokenized stock features.
   * Defaults to the United States and sanctioned jurisdictions pending confirmation with counsel.
   *
   * TODO: Legal counsel to provide confirmed list of restricted and sanctioned jurisdictions.
   */
  defaultRestrictedRegions: readonly string[];
  /** Mode assigned to restricted regions ("exit-only" allows withdrawing/repaying/redeeming/selling) */
  restrictedRegionMode: ComplianceRegionMode;
  /** Per-feature restricted region overrides */
  featureRestrictedRegions: Record<ComplianceFeatureKey, readonly string[]>;
  /** Canonical URL to issuer terms of service */
  issuerTermsUrl: string;
  /** Risk acknowledgement modal content version */
  acknowledgementVersion: string;
  /** Pluggable sanctions screening configuration */
  sanctions: {
    enabled: boolean;
    provider: "chainalysis_oracle" | "trm_labs" | "elliptic" | "mock";
  };
}

/**
 * DEFAULT RESTRICTED JURISDICTIONS (DRAFT PENDING LEGAL COUNSEL REVIEW)
 *
 * United States (US) - Due to regulatory restrictions on unregistered securities / derivatives.
 * Sanctioned Jurisdictions (OFAC / International Sanctions):
 * - CU: Cuba
 * - IR: Iran
 * - KP: North Korea
 * - SY: Syria
 * - RU: Russia
 * - BY: Belarus
 * - MM: Myanmar (Burma)
 * - VE: Venezuela (spec. entities)
 *
 * TODO: Confirm final list with qualified legal counsel.
 */
export const DEFAULT_RESTRICTED_REGIONS: readonly string[] = Object.freeze([
  "US", // United States
  "CU", // Cuba
  "IR", // Iran
  "KP", // North Korea
  "SY", // Syria
  "RU", // Russia
  "BY", // Belarus
  "MM", // Myanmar
  "VE", // Venezuela
]);

/**
 * Reads remote kill switch or configuration from Vercel Edge Config if available.
 * Safely falls back to environment variables and local defaults.
 */
export async function fetchRemoteKillSwitch(): Promise<boolean> {
  // 1. Direct environment variable override
  if (process.env.COMPLIANCE_GLOBAL_KILL_SWITCH === "true") {
    return true;
  }
  if (process.env.NEXT_PUBLIC_COMPLIANCE_KILL_SWITCH === "true") {
    return true;
  }

  // 2. Vercel Edge Config integration (if EDGE_CONFIG connection string is configured)
  const edgeConfigUrl = process.env.EDGE_CONFIG || process.env.COMPLIANCE_REMOTE_CONFIG_URL;
  if (!edgeConfigUrl) {
    return false;
  }

  try {
    // Vercel Edge Config HTTP API read (timeout capped at 1.5s for zero noticeable latency)
    const url = edgeConfigUrl.includes("/item/")
      ? edgeConfigUrl
      : `${edgeConfigUrl.replace(/\/$/, "")}/item/stock_features_kill_switch`;

    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });

    if (res.ok) {
      const data = await res.json();
      return Boolean(data === true || data?.value === true || data?.killSwitch === true);
    }
  } catch {
    // Safe fallback: never crash if remote config is unreachable
  }

  return false;
}

/**
 * Build the active compliance configuration from environment variables and defaults.
 */
export function getComplianceConfig(): ComplianceConfig {
  const killSwitchEnv =
    process.env.COMPLIANCE_GLOBAL_KILL_SWITCH === "true" ||
    process.env.NEXT_PUBLIC_COMPLIANCE_KILL_SWITCH === "true";

  const regionsFromEnv = process.env.COMPLIANCE_RESTRICTED_REGIONS
    ? process.env.COMPLIANCE_RESTRICTED_REGIONS.split(",")
        .map((r) => r.trim().toUpperCase())
        .filter(Boolean)
    : DEFAULT_RESTRICTED_REGIONS;

  const modeFromEnv = (process.env.COMPLIANCE_REGION_MODE as ComplianceRegionMode) || "exit-only";

  return {
    globalKillSwitch: killSwitchEnv,
    features: {
      "stocks.swap": process.env.COMPLIANCE_FEATURE_STOCKS_SWAP !== "false",
      "stocks.lend": process.env.COMPLIANCE_FEATURE_STOCKS_LEND !== "false",
      "stocks.launchPairs": process.env.COMPLIANCE_FEATURE_STOCKS_LAUNCH !== "false",
      "stocks.vouchers": process.env.COMPLIANCE_FEATURE_STOCKS_VOUCHERS !== "false",
    },
    defaultRestrictedRegions: regionsFromEnv,
    restrictedRegionMode: modeFromEnv,
    featureRestrictedRegions: {
      "stocks.swap": regionsFromEnv,
      "stocks.lend": regionsFromEnv,
      "stocks.launchPairs": regionsFromEnv,
      "stocks.vouchers": regionsFromEnv,
    },
    issuerTermsUrl: "https://www.coinbase.com/legal/tokenized-stocks",
    acknowledgementVersion: "1.0",
    sanctions: {
      enabled: process.env.COMPLIANCE_SANCTIONS_SCREENING_ENABLED === "true",
      provider:
        (process.env.COMPLIANCE_SANCTIONS_PROVIDER as any) || "chainalysis_oracle",
    },
  };
}

/**
 * Singleton instance of compliance configuration.
 */
export const complianceConfig: ComplianceConfig = getComplianceConfig();

/**
 * Evaluates regional eligibility for a given country code and feature.
 *
 * @param countryCode - 2-letter ISO 3166-1 alpha-2 country code (detected server-side)
 * @param feature - The specific stock feature being requested
 * @param configOverride - Optional configuration override
 */
export function evaluateRegionCompliance(
  countryCode: string | null | undefined,
  feature?: ComplianceFeatureKey,
  configOverride?: Partial<ComplianceConfig>
): {
  isRestricted: boolean;
  mode: ComplianceRegionMode;
  reason: string | null;
  canEnter: boolean;
  canExit: boolean;
} {
  const base = getComplianceConfig();
  const config: ComplianceConfig = {
    ...base,
    ...configOverride,
    restrictedRegionMode:
      (configOverride as any)?.mode ||
      configOverride?.restrictedRegionMode ||
      base.restrictedRegionMode,
    features: {
      ...base.features,
      ...(configOverride?.features || {}),
    },
    featureRestrictedRegions: {
      ...base.featureRestrictedRegions,
      ...(configOverride?.featureRestrictedRegions || {}),
    },
    sanctions: {
      ...base.sanctions,
      ...(configOverride?.sanctions || {}),
    },
  };

  // 1. Global Kill Switch check
  if (config.globalKillSwitch) {
    return {
      isRestricted: true,
      mode: "exit-only",
      reason: "Tokenized stock features are temporarily paused for maintenance.",
      canEnter: false,
      canExit: true, // Always permit exit
    };
  }

  // 2. Feature-specific flag check
  if (feature && !config.features[feature]) {
    return {
      isRestricted: true,
      mode: "exit-only",
      reason: `The ${feature} feature is currently disabled by administrative policy.`,
      canEnter: false,
      canExit: true,
    };
  }

  // 3. Country evaluation
  const country = countryCode?.trim().toUpperCase();
  if (!country) {
    // If country is unknown, apply safe exit-only mode fallback (protects user funds while disabling new entries)
    return {
      isRestricted: true,
      mode: config.restrictedRegionMode || "exit-only",
      reason: "Location could not be verified. Safe exit-only mode is active.",
      canEnter: false,
      canExit: true,
    };
  }

  const restrictedList = feature
    ? config.featureRestrictedRegions[feature] || config.defaultRestrictedRegions
    : config.defaultRestrictedRegions;

  const isRestricted = restrictedList.includes(country);

  if (isRestricted) {
    const mode = config.restrictedRegionMode;
    return {
      isRestricted: true,
      mode,
      reason: "Tokenized stock features are not available in your region.",
      canEnter: mode === "full",
      canExit: mode === "exit-only" || mode === "full",
    };
  }

  return {
    isRestricted: false,
    mode: "full",
    reason: null,
    canEnter: true,
    canExit: true,
  };
}
