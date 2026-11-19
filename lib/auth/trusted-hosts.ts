/**
 * Which hosts a sign-in may be bound to.
 *
 * A SIWE / Sign in with Farcaster message names the site it was signed for. We only accept our
 * own sites, never one the browser or the token claims for itself. Otherwise a phishing site (or
 * another mini app) could collect a user's signature or Quick Auth token and replay it here to
 * log in as them.
 *
 * Trusted: the configured app URL, the production domains, the host this request actually
 * arrived on (Vercel only routes our own domains to this deployment; locally it's localhost),
 * and this project's own Vercel preview URLs.
 */
import { getAppUrl } from "@/lib/constants/app-url";

import { PREVIEW_HOST, PRODUCTION_HOSTS } from "@/lib/auth/host-list";

export { PRODUCTION_HOSTS };

export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const cleaned = host.split(",")[0]?.trim().toLowerCase();
  if (!cleaned) return null;
  return cleaned.replace(/:80$/, "").replace(/:443$/, "");
}

function withAndWithoutWww(host: string): string[] {
  const bare = host.replace(/^www\./, "");
  return [bare, `www.${bare}`];
}

/** Explicit list of hosts (without the preview pattern), for verifiers that need concrete domains. */
export function trustedAppHosts(requestHost?: string | null): string[] {
  const out = new Set<string>();
  const add = (h: string | null) => {
    if (!h) return;
    for (const v of withAndWithoutWww(h)) out.add(v);
    out.add(h);
  };
  try {
    add(normalizeHost(new URL(getAppUrl()).host));
  } catch {
    /* ignore a malformed app URL */
  }
  for (const h of PRODUCTION_HOSTS) add(h);
  add(normalizeHost(requestHost));
  return [...out];
}

/** Is `domain` (as written in a signed message / token audience) one of our own sites? */
export function isTrustedAppHost(domain: string | null | undefined, requestHost?: string | null): boolean {
  const d = normalizeHost(domain);
  if (!d) return false;
  if (trustedAppHosts(requestHost).includes(d)) return true;
  const bare = d.split(":")[0];
  if (trustedAppHosts(requestHost).includes(bare)) return true;
  return PREVIEW_HOST.test(bare);
}
