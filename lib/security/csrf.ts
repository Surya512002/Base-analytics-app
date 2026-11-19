/**
 * Cross-site request forgery guard for cookie-authenticated API writes (Edge-safe, no imports
 * beyond the host list).
 *
 * The sign-in cookie is SameSite=None in production so the app works inside the Base App and
 * Farcaster frames. That also means a browser attaches it to requests started by other sites,
 * including a plain HTML <form> POST (no CORS preflight). Without this check, a malicious page
 * could make a signed-in creator approve submissions, enter raffles or save data.
 *
 * Rule: a POST/PUT/PATCH/DELETE to /api/* that carries our session cookie must come from one of
 * our own origins. Requests without the cookie (server-to-server webhooks, crons) are unaffected.
 */
import { PREVIEW_HOST, PRODUCTION_HOSTS } from "@/lib/auth/host-list";

export const SESSION_COOKIE_NAME = "ba_siwe_session";
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

export function isOwnHost(host: string | null, requestHost: string | null, appUrl?: string): boolean {
  if (!host) return false;
  const h = host.replace(/:443$/, "").replace(/:80$/, "");
  const bare = h.split(":")[0]!;
  if ((PRODUCTION_HOSTS as readonly string[]).includes(bare)) return true;
  if (PREVIEW_HOST.test(bare)) return true;
  if (requestHost && h === requestHost.toLowerCase()) return true;
  const app = hostOf(appUrl ?? null);
  if (app && (h === app || bare === app.split(":")[0])) return true;
  return false;
}

export interface CsrfInput {
  method: string;
  pathname: string;
  hasSessionCookie: boolean;
  origin: string | null;
  referer: string | null;
  secFetchSite: string | null;
  requestHost: string | null;
  appUrl?: string;
}

/** Returns a reason string when the request must be refused, or null when it's fine. */
export function csrfViolation(r: CsrfInput): string | null {
  if (!WRITE_METHODS.has(r.method.toUpperCase())) return null;
  if (!r.pathname.startsWith("/api/")) return null;
  if (!r.hasSessionCookie) return null;
  // Modern browsers label the initiator; "cross-site" with our cookie is never legitimate.
  if (r.secFetchSite === "cross-site") return "cross-site request";
  const origin = r.origin && r.origin !== "null" ? hostOf(r.origin) : null;
  if (r.origin === "null") return "opaque origin";
  if (origin) return isOwnHost(origin, r.requestHost, r.appUrl) ? null : "foreign origin";
  // No Origin (older browsers on same-origin requests): fall back to Referer when present.
  const ref = hostOf(r.referer);
  if (ref) return isOwnHost(ref, r.requestHost, r.appUrl) ? null : "foreign referer";
  return null;
}
