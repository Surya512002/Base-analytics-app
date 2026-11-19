import { NextResponse, type NextRequest } from "next/server";
import { getComplianceConfig, evaluateRegionCompliance } from "@/src/config/compliance";
import { isLimitOrdersFeatureEnabled } from "@/src/lib/limitOrders/featureFlag";
import { trustedCountryFromHeaders } from "@/lib/compliance/request-country";
import { csrfViolation, SESSION_COOKIE_NAME } from "@/lib/security/csrf";

/**
 * Next.js Edge Middleware for Server-Side Compliance & Geolocation Header Injection
 *
 * Detects visitor country using Vercel's edge network headers (`x-vercel-ip-country`).
 * Injects sanitized compliance context headers into incoming requests for downstream
 * Server Components and API Routes.
 */
export function middleware(request: NextRequest) {
  // 0. Refuse cross-site writes that ride on our sign-in cookie (see lib/security/csrf.ts).
  const csrf = csrfViolation({
    method: request.method,
    pathname: request.nextUrl.pathname,
    hasSessionCookie: request.cookies.has(SESSION_COOKIE_NAME),
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    secFetchSite: request.headers.get("sec-fetch-site"),
    requestHost: request.headers.get("host"),
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (csrf) {
    return NextResponse.json({ error: "Request blocked: it didn't come from this app." }, { status: 403 });
  }

  // 1. Detect country from official Vercel header, Cloudflare header, or test header
  // Only the platform's header counts in production (lib/compliance/request-country.ts).
  const country = trustedCountryFromHeaders(request.headers);

  // 2. Evaluate compliance mode against central configuration
  const config = getComplianceConfig();
  const evaluation = evaluateRegionCompliance(country, undefined, config);

  // 3. Clone request headers and inject server-verified compliance state
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-country", country || "UNKNOWN");
  requestHeaders.set("x-compliance-restricted", evaluation.isRestricted ? "true" : "false");
  requestHeaders.set("x-compliance-mode", evaluation.mode);
  requestHeaders.set("x-compliance-can-enter", evaluation.canEnter ? "true" : "false");
  requestHeaders.set("x-compliance-can-exit", evaluation.canExit ? "true" : "false");
  requestHeaders.set("x-limit-orders-enabled", isLimitOrdersFeatureEnabled() ? "true" : "false");

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Also reflect headers on response for client inspection if needed
  response.headers.set("x-compliance-restricted", evaluation.isRestricted ? "true" : "false");
  response.headers.set("x-compliance-mode", evaluation.mode);
  response.headers.set("x-limit-orders-enabled", isLimitOrdersFeatureEnabled() ? "true" : "false");

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (/tokens/, /badges/, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|tokens/|badges/|fonts/).*)",
  ],
};
