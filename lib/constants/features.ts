/**
 * Feature Flags Configuration
 * All new futuristic features are guarded behind env-overridable feature flags.
 * Each feature can be turned ON/OFF via NEXT_PUBLIC_FEATURE_<KEY> environment variables.
 */

function parseBooleanEnv(key: string, defaultValue: boolean): boolean {
  if (typeof process === "undefined" || !process.env) return defaultValue;
  const val = process.env[key];
  if (val === "true" || val === "1") return true;
  if (val === "false" || val === "0") return false;
  return defaultValue;
}

export const FEATURES = {
  // Phase 1: Foundation
  INTENT_BAR: parseBooleanEnv("NEXT_PUBLIC_FEATURE_INTENT_BAR", true),
  PWA_OFFLINE_SHELL: parseBooleanEnv("NEXT_PUBLIC_FEATURE_PWA_OFFLINE_SHELL", true),
  I18N_LOCALIZATION: parseBooleanEnv("NEXT_PUBLIC_FEATURE_I18N_LOCALIZATION", true),
  FUTURISTIC_THEME: parseBooleanEnv("NEXT_PUBLIC_FEATURE_FUTURISTIC_THEME", true),

  // Phase 2: Differentiating Features
  TOKEN_XRAY: parseBooleanEnv("NEXT_PUBLIC_FEATURE_TOKEN_XRAY", true),
  SWAP_PREVIEW: parseBooleanEnv("NEXT_PUBLIC_FEATURE_SWAP_PREVIEW", true),
  LIQUIDATION_GUARD: parseBooleanEnv("NEXT_PUBLIC_FEATURE_LIQUIDATION_GUARD", true),
  SMART_MONEY_RADAR: parseBooleanEnv("NEXT_PUBLIC_FEATURE_SMART_MONEY_RADAR", true),
  PORTFOLIO_TIME_MACHINE: parseBooleanEnv("NEXT_PUBLIC_FEATURE_PORTFOLIO_TIME_MACHINE", true),
  YIELD_FINDER: parseBooleanEnv("NEXT_PUBLIC_FEATURE_YIELD_FINDER", true),
  STOCK_NAV_TRACKER: parseBooleanEnv("NEXT_PUBLIC_FEATURE_STOCK_NAV_TRACKER", true),
  SMARTER_ALERTS: parseBooleanEnv("NEXT_PUBLIC_FEATURE_SMARTER_ALERTS", true),
  LAUNCH_SIMULATOR: parseBooleanEnv("NEXT_PUBLIC_FEATURE_LAUNCH_SIMULATOR", true),
  GIFT_CAPSULES: parseBooleanEnv("NEXT_PUBLIC_FEATURE_GIFT_CAPSULES", true),
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function isFeatureEnabled(key: FeatureKey): boolean {
  return FEATURES[key] ?? false;
}
