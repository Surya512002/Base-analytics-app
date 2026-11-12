/**
 * Shared-link voucher campaigns ("one link, first N wallets claim").
 *
 * Pure helpers (no network) shared by the creator UI, claim UI and API routes.
 * The campaign secret is generated in the creator's browser and only ever travels
 * in the URL *fragment* (never sent to any server); only its hash goes onchain.
 */
import {
  encodeAbiParameters,
  getAddress,
  isAddress,
  keccak256,
  parseAbiParameters,
  toBytes,
} from "viem";

export const CAMPAIGN_MAX_CLAIMS = 1000;
export const CAMPAIGN_MAX_MESSAGE = 280;
export const CAMPAIGN_MAX_LABEL = 40;
export const CAMPAIGN_TICKET_TTL_SEC = 10 * 60;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

// ───────────────────────────── secret / link ─────────────────────────────

/** 160-bit random secret, hex. Uses WebCrypto (browser + Node 20). */
export function generateCampaignSecret(): string {
  const bytes = new Uint8Array(20);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function hashCampaignSecret(secret: string): `0x${string}` {
  return keccak256(toBytes(secret));
}

export function normalizeCampaignSecret(raw: string): string {
  return raw.trim().replace(/\s/g, "");
}

export function isValidCampaignSecret(secret: string): boolean {
  return /^[A-Za-z0-9_-]{16,128}$/.test(secret);
}

/** Link the creator shares. Secret lives in the fragment so servers/CDNs/referrers never see it. */
export function buildCampaignLink(
  campaignId: number | bigint | string,
  secret: string,
  baseUrl: string
): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/?tab=basehub&view=campaign#camp=${encodeURIComponent(String(campaignId))}&k=${encodeURIComponent(secret)}`;
}

/** Short, previewable link for chat/OG (carries the same fragment). */
export function buildCampaignShortLink(
  campaignId: number | bigint | string,
  secret: string,
  baseUrl: string
): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/claim/${encodeURIComponent(String(campaignId))}#k=${encodeURIComponent(secret)}`;
}

export interface ParsedCampaignLink {
  campaignId: string | null;
  secret: string | null;
}

export function parseCampaignLink(input: {
  pathname?: string;
  search?: string;
  hash?: string;
}): ParsedCampaignLink {
  const hash = new URLSearchParams((input.hash || "").replace(/^#/, ""));
  const query = new URLSearchParams((input.search || "").replace(/^\?/, ""));
  const pathMatch = /^\/claim\/(\d{1,12})\/?$/.exec(input.pathname || "");
  const rawId = hash.get("camp") || query.get("camp") || pathMatch?.[1] || null;
  const rawSecret = hash.get("k");
  const campaignId = rawId && /^\d{1,12}$/.test(rawId.trim()) ? rawId.trim() : null;
  const secret = rawSecret ? normalizeCampaignSecret(rawSecret) : null;
  return {
    campaignId,
    secret: secret && isValidCampaignSecret(secret) ? secret : null,
  };
}

// ───────────────────────────── claim tickets ─────────────────────────────

/**
 * The 32-byte inner hash the claim signer personal_signs. Must match
 * keccak256(abi.encode(block.chainid, address(this), campaignId, claimer, deadline))
 * in BaseVoucherCampaign.claimDigest.
 */
export function campaignTicketInnerHash(args: {
  chainId: number;
  contract: `0x${string}`;
  campaignId: bigint;
  claimer: `0x${string}`;
  deadline: bigint;
}): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("uint256, address, uint256, address, uint64"),
      [BigInt(args.chainId), args.contract, args.campaignId, args.claimer, args.deadline]
    )
  );
}

// ───────────────────────────── validation ────────────────────────────────

export interface CampaignInput {
  asset: string;
  /** Human total, e.g. "50" USDC / "0.05" ETH / "2" shares. */
  total: string;
  maxClaims: number;
  message: string;
  senderLabel: string;
  unlockAt?: number; // unix seconds
  expiresAt?: number; // unix seconds
  committed: boolean;
  gated: boolean;
}

export interface CampaignValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCampaignInput(
  input: CampaignInput,
  nowSec = Math.floor(Date.now() / 1000)
): CampaignValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Number.isInteger(input.maxClaims) || input.maxClaims < 1 || input.maxClaims > CAMPAIGN_MAX_CLAIMS) {
    errors.push(`Claim slots must be a whole number from 1 to ${CAMPAIGN_MAX_CLAIMS}.`);
  }
  if (!/^\d+(\.\d+)?$/.test(input.total.trim()) || Number(input.total) <= 0) {
    errors.push("Enter a total amount greater than zero.");
  }
  if (new TextEncoder().encode(input.message).length > CAMPAIGN_MAX_MESSAGE) {
    errors.push(`Message is too long (max ${CAMPAIGN_MAX_MESSAGE} bytes).`);
  }
  if (new TextEncoder().encode(input.senderLabel).length > CAMPAIGN_MAX_LABEL) {
    errors.push(`Sender name is too long (max ${CAMPAIGN_MAX_LABEL} bytes).`);
  }
  if (input.expiresAt !== undefined && input.expiresAt <= nowSec + 60) {
    errors.push("Expiry must be at least a minute in the future.");
  }
  if (input.unlockAt !== undefined && input.expiresAt !== undefined && input.expiresAt <= input.unlockAt) {
    errors.push("Expiry must be after the unlock time.");
  }
  if (input.committed && input.expiresAt === undefined) {
    errors.push("Committed campaigns need an expiry so unclaimed funds can come back.");
  }
  if (input.expiresAt === undefined) {
    warnings.push("No expiry: unclaimed funds stay escrowed until you cancel the campaign.");
  }
  if (!input.gated) {
    warnings.push(
      "Open claims: anyone with the link (including bots using many wallets) can claim. Turn on verified claims to add region checks and rate limits."
    );
  }
  return { ok: errors.length === 0, errors, warnings };
}

// ───────────────────────────── status / identity ─────────────────────────

export interface OnchainCampaign {
  creator: `0x${string}`;
  token: `0x${string}`;
  amountPerClaim: bigint;
  maxClaims: number;
  claimedCount: number;
  unlockAt: number;
  expiresAt: number;
  claimSigner: `0x${string}`;
  committed: boolean;
  closed: boolean;
}

export type CampaignStatus = "open" | "locked" | "expired" | "full" | "closed";

export function campaignStatus(c: OnchainCampaign, nowSec = Math.floor(Date.now() / 1000)): CampaignStatus {
  if (c.closed) return "closed";
  if (c.expiresAt > 0 && nowSec >= c.expiresAt) return "expired";
  if (c.claimedCount >= c.maxClaims) return "full";
  if (c.unlockAt > 0 && nowSec < c.unlockAt) return "locked";
  return "open";
}

export function isCampaignGated(c: Pick<OnchainCampaign, "claimSigner">): boolean {
  return c.claimSigner.toLowerCase() !== ZERO_ADDRESS;
}

export type SenderTrust = "basename-verified" | "address-only" | "unverified-label";

export interface SenderIdentity {
  /** Checksummed creator address — taken from the contract, cannot be spoofed. */
  address: `0x${string}`;
  /** Reverse-resolved Basename for the creator address, if any. */
  basename: string | null;
  /** Free-text label the creator typed (display only). */
  label: string;
  trust: SenderTrust;
  basescanUrl: string;
}

/**
 * Combine the onchain creator address with the (untrusted) label and a reverse-resolved basename.
 * A label is only presented as verified when it equals the creator's own reverse-resolved name.
 */
export function buildSenderIdentity(
  creator: string,
  label: string,
  basename: string | null
): SenderIdentity {
  const address = (isAddress(creator) ? getAddress(creator) : creator) as `0x${string}`;
  const cleanLabel = label.trim();
  // A typed name is only presented as verified when it equals the creator's own reverse-resolved name.
  const labelMatches = !cleanLabel || (basename !== null && cleanLabel.toLowerCase() === basename.toLowerCase());
  const trust: SenderTrust = basename && labelMatches ? "basename-verified" : cleanLabel ? "unverified-label" : "address-only";
  return {
    address,
    basename,
    label: cleanLabel,
    trust,
    basescanUrl: `https://basescan.org/address/${address}`,
  };
}

/** Friendly onchain revert → user message. */
export function explainCampaignError(message: string): string {
  const m = message || "";
  const table: Array<[string, string]> = [
    ["All claims taken", "All claim slots have been taken — you were too late this time."],
    ["Already claimed", "This wallet has already claimed from this campaign."],
    ["Invalid secret", "This link's secret is wrong or incomplete. Ask the sender for the original link."],
    ["Not unlocked yet", "This campaign hasn't unlocked yet."],
    ["Campaign expired", "This campaign has expired."],
    ["Campaign closed", "The sender closed this campaign."],
    ["Creator cannot claim", "The sender can't claim their own campaign."],
    ["Ticket expired", "Your claim ticket expired. Try again."],
    ["Invalid ticket", "Claim verification failed. Try again."],
    ["Invalid campaign", "Campaign not found."],
    ["Committed until expiry", "This campaign is committed — funds stay escrowed until it expires."],
    ["User rejected", "You cancelled the request in your wallet."],
  ];
  for (const [needle, text] of table) if (m.includes(needle)) return text;
  return "Transaction failed. Nothing was sent — please try again.";
}
