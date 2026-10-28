import { NextResponse, type NextRequest } from "next/server";
import { getComplianceConfig, evaluateRegionCompliance } from "@/src/config/compliance";

/**
 * Next.js Edge Middleware for Server-Side Compliance & Geolocation Header Injection
 *
 * Detects visitor country using Vercel's edge network headers (`x-vercel-ip-country`).
 * Injects sanitized compliance context headers into incoming requests for downstream
 * Server Components and API Routes.
 */
export function middleware(request: NextRequest) {
  // 1. Detect country from official Vercel header, Cloudflare header, or test header
  const countryHeader =
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-mock-country") ||
    process.env.COMPLIANCE_MOCK_COUNTRY ||
    null;

  const country = countryHeader?.trim().toUpperCase() || null;

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

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Also reflect headers on response for client inspection if needed
  response.headers.set("x-compliance-restricted", evaluation.isRestricted ? "true" : "false");
  response.headers.set("x-compliance-mode", evaluation.mode);

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
