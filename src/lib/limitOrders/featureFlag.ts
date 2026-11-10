/**
 * Unified single source of truth for the Limit Orders / Pro Orders feature flag.
 * Browser-safe: only relies on NEXT_PUBLIC_ prefixed environment variables
 * and standard NODE_ENV.
 */

export interface FeatureFlagOptions {
  limitOrdersEnabled?: string;
  vercelEnv?: string;
  nodeEnv?: string;
}

export function isVercelPreview(options?: FeatureFlagOptions): boolean {
  const vercelEnv =
    options?.vercelEnv !== undefined
      ? options.vercelEnv
      : process.env.NEXT_PUBLIC_VERCEL_ENV;
  return vercelEnv === "preview";
}

export function isExplicitLimitOrdersEnabled(options?: FeatureFlagOptions): boolean {
  const flag =
    options?.limitOrdersEnabled !== undefined
      ? options.limitOrdersEnabled
      : process.env.NEXT_PUBLIC_LIMIT_ORDERS_ENABLED;
  return flag === "true";
}

/**
 * Returns true if the limit orders feature is enabled.
 *
 * Rules:
 * 1. Explicitly enabled if NEXT_PUBLIC_LIMIT_ORDERS_ENABLED === "true"
 * 2. Enabled in Vercel preview environments (NEXT_PUBLIC_VERCEL_ENV === "preview")
 * 3. Enabled in local development or test runners (NODE_ENV !== "production")
 * 4. Disabled in production unless explicitly turned on via NEXT_PUBLIC_LIMIT_ORDERS_ENABLED === "true"
 */
export function isLimitOrdersFeatureEnabled(options?: FeatureFlagOptions): boolean {
  const flag =
    options?.limitOrdersEnabled !== undefined
      ? options.limitOrdersEnabled
      : process.env.NEXT_PUBLIC_LIMIT_ORDERS_ENABLED;

  const vercelEnv =
    options?.vercelEnv !== undefined
      ? options.vercelEnv
      : process.env.NEXT_PUBLIC_VERCEL_ENV;

  const nodeEnv =
    options?.nodeEnv !== undefined
      ? options.nodeEnv
      : process.env.NODE_ENV;

  // Explicit flag takes highest priority
  if (flag === "true") {
    return true;
  }
  if (flag === "false") {
    return false;
  }

  // Vercel Preview environment enables the feature for staging QA
  if (vercelEnv === "preview") {
    return true;
  }

  // Local development and unit test environments
  if (nodeEnv !== "production") {
    return true;
  }

  // Production default is disabled unless flag is explicitly "true"
  return false;
}
