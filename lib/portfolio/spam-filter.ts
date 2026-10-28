/**
 * Portfolio Spam & Safety Engine for Base Mainnet.
 *
 * Detects scam airdrops, phishing tokens, and malicious URL names.
 * Ensures plain-text rendering and safe token validation.
 */

// Domain extensions often found in phishing airdrops
const SUSPICIOUS_DOMAINS_REGEX =
  /\.(com|io|xyz|org|net|link|app|top|club|vip|site|online|me|cc|biz|info|live|pro|space|fun|co|run|pw|tk)\b/i;

// URL indicators
const URL_INDICATORS_REGEX = /(https?:\/\/|www\.|\bt\.me\/|\btelegram\b|\bdiscord\.gg\/)/i;

// Phishing action words
const SCAM_KEYWORDS_REGEX =
  /\b(claim|visit|airdrop|reward|rewards|voucher|vouchers|bonus|gift|winner|free|presale|whitelist|verify|unlock|activate)\b/i;

export interface SpamCheckResult {
  isSpam: boolean;
  reason?: string;
}

/**
 * Evaluates whether a token is likely a spam or phishing airdrop.
 */
export function evaluateTokenSpam(token: {
  name?: string | null;
  symbol?: string | null;
  address?: string | null;
  hasPool?: boolean;
  liquidityUsd?: number | null;
  totalSupply?: bigint | string | null;
  isFlaggedSpam?: boolean;
}): SpamCheckResult {
  if (token.isFlaggedSpam) {
    return { isSpam: true, reason: "Flagged as spam by indexer" };
  }

  const name = (token.name || "").trim();
  const symbol = (token.symbol || "").trim();
  const combined = `${name} ${symbol}`;

  // 1. Phishing URLs in name or symbol
  if (URL_INDICATORS_REGEX.test(combined)) {
    return { isSpam: true, reason: "Contains URL or phishing link in token metadata" };
  }

  // 2. Suspicious web domains in name or symbol
  if (SUSPICIOUS_DOMAINS_REGEX.test(combined)) {
    return { isSpam: true, reason: "Contains web domain in token metadata" };
  }

  // 3. Scam keywords (e.g. "Visit Claim-Airdrop.com")
  if (SCAM_KEYWORDS_REGEX.test(combined)) {
    return { isSpam: true, reason: "Contains suspicious airdrop/claim keywords" };
  }

  // 4. Astronomical supply with zero liquidity (typical unsolicited scam airdrop)
  if (token.liquidityUsd != null && token.liquidityUsd <= 1 && token.hasPool === false) {
    // If supply is >= 1 trillion and no pool exists, flag as suspicious
    if (token.totalSupply) {
      const supplyStr = typeof token.totalSupply === "bigint" ? token.totalSupply.toString() : token.totalSupply;
      if (supplyStr.length > 27) {
        // More than 10^27 wei / 1 billion tokens without pool
        return { isSpam: true, reason: "Unsolicited high-supply token with zero liquidity" };
      }
    }
  }

  return { isSpam: false };
}

/**
 * Sanitizes token name or symbol to strictly plain text.
 * Strips HTML tags, control characters, and limits character length.
 */
export function sanitizeTokenString(input: string | null | undefined, maxLength = 32): string {
  if (!input) return "";

  // Strip all HTML tags
  let clean = input.replace(/<[^>]*>/g, "");

  // Remove zero-width spaces and control characters
  clean = clean.replace(/[\u200B-\u200D\uFEFF\x00-\x1F\x7F]/g, "");

  // Normalize whitespaces
  clean = clean.replace(/\s+/g, " ").trim();

  // Enforce max length
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength - 1) + "…";
  }

  return clean || "Unknown";
}

/**
 * Default dust threshold for hiding tiny balances (< $0.01)
 */
export const DUST_USD_THRESHOLD = 0.01;
