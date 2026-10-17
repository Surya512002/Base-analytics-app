/**
 * Voucher Claim Link Parser & Formatter
 * 
 * Supports all legacy and modern voucher claim link formats:
 * 1. Safe Fragment URL: /?tab=basehub&view=redeem#id=41-0&secret=XYZ or #id=41-0&key=XYZ
 * 2. Query Param URL: /?tab=basehub&card=41-0&secret=XYZ
 * 3. Legacy Tab Aliases: /?tab=voucher&card=41-0 or /?tab=vouchers&cardId=41-0
 * 4. Alternate Key Names: card / id / cardId / c / voucher and secret / key / s
 * 5. Dedicated /redeem page: /redeem?card=41-0 or /redeem#id=41-0&secret=XYZ
 * 6. Root Hash URL: /#id=41-0&secret=XYZ
 */

export interface ParsedClaimLink {
  cardId: string | null;
  secret: string | null;
  hasVoucherIntent: boolean;
}

const CARD_PARAM_KEYS = ["card", "id", "cardId", "c", "voucher"];
const SECRET_PARAM_KEYS = ["secret", "key", "s"];

/**
 * Validates whether a card ID follows the batch-index format: <batchId>-<cardIndex>
 * e.g., "41-0", "132-5"
 */
export function isValidCardIdFormat(cardId: string): boolean {
  return /^\d+-\d+$/.test(cardId.trim());
}

/**
 * Normalizes a raw secret string: trims whitespace and converts to uppercase
 * since voucher secrets in Base Analytics are standardized alphanumeric.
 */
export function normalizeSecret(secret: string): string {
  return secret.trim().toUpperCase();
}

/**
 * Extracts param value checking multiple possible keys in order
 */
function getFirstParam(params: URLSearchParams, keys: string[]): string | null {
  for (const k of keys) {
    const val = params.get(k);
    if (val && val.trim()) {
      return val.trim();
    }
  }
  return null;
}

/**
 * Parses claim parameters from a full URL, relative URL, or parts object.
 */
export function parseClaimLink(
  input?: string | { search?: string; hash?: string; pathname?: string }
): ParsedClaimLink {
  let searchStr = "";
  let hashStr = "";
  let pathname = "";

  if (typeof input === "string") {
    try {
      // Support relative or absolute URLs
      const dummyOrigin = "https://base-analytics.local";
      const parsed = new URL(input, dummyOrigin);
      searchStr = parsed.search;
      hashStr = parsed.hash;
      pathname = parsed.pathname;
    } catch {
      // Fallback manual splitting if URL parse fails
      const hashSplit = input.split("#");
      const baseAndQuery = hashSplit[0] || "";
      hashStr = hashSplit[1] ? `#${hashSplit[1]}` : "";
      const querySplit = baseAndQuery.split("?");
      pathname = querySplit[0] || "";
      searchStr = querySplit[1] ? `?${querySplit[1]}` : "";
    }
  } else if (input && typeof input === "object") {
    searchStr = input.search || "";
    hashStr = input.hash || "";
    pathname = input.pathname || "";
  } else if (typeof window !== "undefined") {
    searchStr = window.location.search;
    hashStr = window.location.hash;
    pathname = window.location.pathname;
  }

  const queryParams = new URLSearchParams(searchStr.replace(/^\?/, ""));
  const hashClean = hashStr.replace(/^#/, "");
  const hashParams = new URLSearchParams(hashClean);

  // Preference order:
  // Hash parameters take precedence for secrets (privacy best practice so secret is not in HTTP logs)
  // Card ID can come from either hash or query params
  const cardIdRaw =
    getFirstParam(hashParams, CARD_PARAM_KEYS) ||
    getFirstParam(queryParams, CARD_PARAM_KEYS);

  const secretRaw =
    getFirstParam(hashParams, SECRET_PARAM_KEYS) ||
    getFirstParam(queryParams, SECRET_PARAM_KEYS);

  const tab = queryParams.get("tab")?.toLowerCase();
  const isVoucherTab = tab === "voucher" || tab === "vouchers" || tab === "basehub";
  const isRedeemPath = pathname === "/redeem" || pathname.startsWith("/redeem/");

  const cardId = cardIdRaw ? cardIdRaw.trim() : null;
  const secret = secretRaw ? normalizeSecret(secretRaw) : null;

  const hasVoucherIntent = Boolean(
    cardId !== null ||
    secret !== null ||
    isRedeemPath ||
    (isVoucherTab && (queryParams.get("view") === "redeem" || queryParams.has("card")))
  );

  return {
    cardId,
    secret,
    hasVoucherIntent,
  };
}

/**
 * Checks current browser window location and localStorage for redeem data.
 */
export function parseCurrentUrlClaim(): ParsedClaimLink {
  if (typeof window === "undefined") {
    return { cardId: null, secret: null, hasVoucherIntent: false };
  }

  const parsed = parseClaimLink({
    search: window.location.search,
    hash: window.location.hash,
    pathname: window.location.pathname,
  });

  // Check localStorage fallback if cardId not yet found
  if (!parsed.cardId) {
    try {
      const stored = localStorage.getItem("base_redeem_card");
      if (stored && stored.trim()) {
        return {
          ...parsed,
          cardId: stored.trim(),
          hasVoucherIntent: true,
        };
      }
    } catch {
      // Ignore storage errors in private browsing
    }
  }

  return parsed;
}

/**
 * Builds standard safe shareable claim link.
 * Default format places secret in hash fragment to keep it out of server logs and referrers.
 */
export function formatClaimLink(
  cardId: string,
  secret?: string,
  options?: {
    baseUrl?: string;
    mode?: "fragment" | "query";
  }
): string {
  const base = options?.baseUrl || (typeof window !== "undefined" ? window.location.origin : "https://base-analytics-app.vercel.app");
  const mode = options?.mode || "fragment";

  if (mode === "fragment") {
    let url = `${base}/?tab=basehub&view=redeem#id=${encodeURIComponent(cardId)}`;
    if (secret) {
      url += `&secret=${encodeURIComponent(secret)}`;
    }
    return url;
  } else {
    const qs = new URLSearchParams({
      tab: "basehub",
      view: "redeem",
      card: cardId,
    });
    if (secret) {
      qs.set("secret", secret);
    }
    return `${base}/?${qs.toString()}`;
  }
}
