/**
 * Soft guards for Vercel Preview deploys.
 * Never pauses production — only throttles scrapers on preview URLs (no hard downtime).
 */
import { NextResponse, type NextRequest } from "next/server";

const BOT_UA =
  /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|linkedinbot|twitterbot|embedly|quora link|pinterest|redditbot|applebot|semrush|ahrefs|bytespider|gptbot|claudebot|petalbot/i;

/** Heavy routes that are expensive for bots to hammer on preview deployments. */
function isExpensiveApi(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/api/launchpad/status")) return false;
  if (pathname.startsWith("/api/health")) return false;
  return (
    pathname.startsWith("/api/analyze-wallet") ||
    pathname.startsWith("/api/wallet-sync") ||
    pathname.startsWith("/api/wallet-txs") ||
    pathname.startsWith("/api/wallet-bootstrap") ||
    pathname.startsWith("/api/wallet-user-ops") ||
    pathname.startsWith("/api/launchpad/discover") ||
    pathname.startsWith("/api/launchpad/market") ||
    pathname.startsWith("/api/premium-scan") ||
    pathname.startsWith("/api/mcp")
  );
}

export function middleware(req: NextRequest) {
  // Production stays fully open. Soft bot filter only on preview deploys.
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.next();
  }

  const ua = req.headers.get("user-agent") || "";
  if (!BOT_UA.test(ua)) {
    return NextResponse.next();
  }

  if (!isExpensiveApi(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return NextResponse.json(
    { error: "Preview API limited for automated clients" },
    {
      status: 403,
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    }
  );
}

export const config = {
  matcher: ["/api/:path*"],
};
