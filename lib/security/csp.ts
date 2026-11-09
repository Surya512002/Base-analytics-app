/**
 * Content Security Policy (CSP) Sanitization Utilities
 *
 * Ensures that only valid, safe HTTP/HTTPS origins from client-safe
 * (NEXT_PUBLIC_) environment variables are appended to connect-src,
 * preventing API key leaks, injection attacks, or exposure of server-only secrets.
 */

export function sanitizeRpcOrigin(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Disallow whitespace, semicolons, quotes or control characters that could corrupt CSP headers
  if (/[\s;"'`]/.test(trimmed)) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    const origin = parsed.origin;
    if (!origin || origin === "null" || /[\s;"'`]/.test(origin)) {
      return null;
    }
    return origin;
  } catch {
    return null;
  }
}

export const BASE_CONNECT_SRC_SOURCES = [
  "'self'",
  "https://mainnet.base.org",
  "https://sepolia.base.org",
  "https://*.alchemy.com",
  "https://api.developer.coinbase.com",
  "https://keys.coinbase.com",
  "https://cca-lite.coinbase.com",
  "https://api.0x.org",
  "https://basescan.org",
  "https://*.basescan.org",
  "https://*.walletconnect.com",
  "wss://*.walletconnect.com",
  "https://*.walletconnect.org",
  "wss://*.walletconnect.org",
  "https://*.farcaster.xyz",
] as const;

export function buildConnectSrcDirective(
  customRpcUrls: (string | undefined | null)[] = []
): string {
  const validOrigins = customRpcUrls
    .map(sanitizeRpcOrigin)
    .filter((origin): origin is string => Boolean(origin));

  // Deduplicate while preserving ordering
  const uniqueSources = Array.from(new Set([...BASE_CONNECT_SRC_SOURCES, ...validOrigins]));
  return `connect-src ${uniqueSources.join(" ")}`;
}
