import { formatUnits, isAddress, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CAMPAIGN_CONTRACT } from "@/lib/constants/env";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { resolveBasename } from "@/lib/utils/resolve-basename";
import { getBaseStockByAddress } from "@/lib/stocks/base-stocks";
import { getVaultShareByAddress, USDC_BASE, USDC_DECIMALS } from "@/lib/utils/voucher";
import { CAMPAIGN_ABI } from "@/lib/voucher/campaign-abi";
import {
  buildSenderIdentity,
  campaignStatus,
  campaignTicketInnerHash,
  isCampaignGated,
  ZERO_ADDRESS,
  type CampaignStatus,
  type OnchainCampaign,
  type SenderIdentity,
} from "@/lib/voucher/campaign";

const BASE_CHAIN_ID = 8453;
const ERC20_META = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

export function campaignContractReady(): boolean {
  return Boolean(CAMPAIGN_CONTRACT);
}

/** Server-held key that signs short-lived claim tickets. Never exposed to the client. */
export function getClaimSigner() {
  const raw = (process.env.CAMPAIGN_CLAIM_SIGNER_KEY || "").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) return null;
  return privateKeyToAccount(raw as `0x${string}`);
}

export type CampaignAssetKind = "eth" | "usdc" | "stock" | "vault" | "other";

export interface CampaignAssetInfo {
  kind: CampaignAssetKind;
  symbol: string;
  decimals: number;
  /** true for tokenized stocks / vault shares → compliance gates apply */
  regulated: boolean;
  /** false for tokens the app does not recognise → show a warning */
  recognised: boolean;
}

export async function describeCampaignAsset(token: `0x${string}`): Promise<CampaignAssetInfo> {
  if (token.toLowerCase() === ZERO_ADDRESS) {
    return { kind: "eth", symbol: "ETH", decimals: 18, regulated: false, recognised: true };
  }
  if (token.toLowerCase() === USDC_BASE.toLowerCase()) {
    return { kind: "usdc", symbol: "USDC", decimals: USDC_DECIMALS, regulated: false, recognised: true };
  }
  const stock = getBaseStockByAddress(token);
  if (stock) {
    return { kind: "stock", symbol: stock.symbol, decimals: stock.decimals, regulated: true, recognised: true };
  }
  const vault = getVaultShareByAddress(token);
  if (vault) {
    return { kind: "vault", symbol: vault.symbol, decimals: vault.decimals, regulated: true, recognised: true };
  }
  const client = createBasePublicClient();
  try {
    const [symbol, decimals] = await Promise.all([
      client.readContract({ address: token, abi: ERC20_META, functionName: "symbol" }),
      client.readContract({ address: token, abi: ERC20_META, functionName: "decimals" }),
    ]);
    return {
      kind: "other",
      symbol: String(symbol).slice(0, 12),
      decimals: Number(decimals),
      regulated: false,
      recognised: false,
    };
  } catch {
    return { kind: "other", symbol: "TOKEN", decimals: 18, regulated: false, recognised: false };
  }
}

export async function readCampaignOnchain(id: bigint): Promise<{
  campaign: OnchainCampaign;
  message: string;
  senderLabel: string;
} | null> {
  if (!CAMPAIGN_CONTRACT) return null;
  const client = createBasePublicClient();
  const [c, message, senderLabel] = (await client.readContract({
    address: CAMPAIGN_CONTRACT,
    abi: CAMPAIGN_ABI,
    functionName: "getCampaign",
    args: [id],
  })) as unknown as [
    {
      creator: `0x${string}`;
      token: `0x${string}`;
      amountPerClaim: bigint;
      maxClaims: number;
      claimedCount: number;
      unlockAt: bigint;
      expiresAt: bigint;
      claimSigner: `0x${string}`;
      linkSigner: `0x${string}`;
      committed: boolean;
      closed: boolean;
    },
    string,
    string,
  ];
  if (!c.maxClaims) return null;
  return {
    campaign: {
      creator: c.creator,
      token: c.token,
      amountPerClaim: c.amountPerClaim,
      maxClaims: Number(c.maxClaims),
      claimedCount: Number(c.claimedCount),
      unlockAt: Number(c.unlockAt),
      expiresAt: Number(c.expiresAt),
      claimSigner: c.claimSigner,
      linkSigner: c.linkSigner,
      committed: c.committed,
      closed: c.closed,
    },
    message,
    senderLabel,
  };
}

export interface CampaignPublicView {
  campaignId: string;
  contract: string;
  status: CampaignStatus;
  asset: CampaignAssetInfo;
  perClaim: string;
  perClaimFormatted: string;
  maxClaims: number;
  claimedCount: number;
  claimsRemaining: number;
  unlockAt: number;
  expiresAt: number;
  committed: boolean;
  gated: boolean;
  message: string;
  sender: SenderIdentity;
}

export async function readCampaignPublicView(id: bigint): Promise<CampaignPublicView | null> {
  const onchain = await readCampaignOnchain(id);
  if (!onchain) return null;
  const { campaign, message, senderLabel } = onchain;
  const [asset, basename] = await Promise.all([
    describeCampaignAsset(campaign.token),
    resolveBasename(campaign.creator).catch(() => null),
  ]);
  const status = campaignStatus(campaign);
  return {
    campaignId: id.toString(),
    contract: CAMPAIGN_CONTRACT,
    status,
    asset,
    perClaim: campaign.amountPerClaim.toString(),
    perClaimFormatted: `${trimDecimals(formatUnits(campaign.amountPerClaim, asset.decimals))} ${asset.symbol}`,
    maxClaims: campaign.maxClaims,
    claimedCount: campaign.claimedCount,
    claimsRemaining: campaign.closed ? 0 : campaign.maxClaims - campaign.claimedCount,
    unlockAt: campaign.unlockAt,
    expiresAt: campaign.expiresAt,
    committed: campaign.committed,
    gated: isCampaignGated(campaign),
    message,
    sender: buildSenderIdentity(campaign.creator, senderLabel, basename),
  };
}

function trimDecimals(v: string): string {
  if (!v.includes(".")) return v;
  return v.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

export async function signClaimTicket(args: {
  campaignId: bigint;
  claimer: `0x${string}`;
  deadline: bigint;
}): Promise<`0x${string}` | null> {
  const signer = getClaimSigner();
  if (!signer || !CAMPAIGN_CONTRACT || !isAddress(args.claimer)) return null;
  const inner = campaignTicketInnerHash({
    chainId: BASE_CHAIN_ID,
    contract: CAMPAIGN_CONTRACT,
    campaignId: args.campaignId,
    claimer: args.claimer,
    deadline: args.deadline,
  });
  return signer.signMessage({ message: { raw: inner } });
}

export async function hasClaimedOnchain(id: bigint, claimer: `0x${string}`): Promise<boolean> {
  if (!CAMPAIGN_CONTRACT) return false;
  const client = createBasePublicClient();
  return client.readContract({
    address: CAMPAIGN_CONTRACT,
    abi: CAMPAIGN_ABI,
    functionName: "hasClaimed",
    args: [id, claimer],
  }) as Promise<boolean>;
}

// ───────────────────────────── recipient eligibility ─────────────────────────────

export interface EligibilityCheck {
  id: "campaign" | "self" | "already" | "killswitch" | "feature" | "region" | "sanctions";
  label: string;
  /** "pass" | "fail" — or "skipped" when a check doesn't apply / isn't configured (never shown as a pass). */
  result: "pass" | "fail" | "skipped";
  detail: string;
}

export interface EligibilityResult {
  eligible: boolean;
  checks: EligibilityCheck[];
  /** First failing check's detail, for a one-line message. */
  reason: string | null;
}

/**
 * Everything we can check about a recipient *before* they claim. Used by the public
 * eligibility endpoint (shown to the recipient up front) and by the ticket route
 * (enforced). Region comes from the CDN geo header; on Vercel the client can't set it.
 */
export async function evaluateClaimEligibility(args: {
  campaignId: bigint;
  campaign: OnchainCampaign;
  claimer: `0x${string}` | null;
  country: string | null;
  /** Optional pre-resolved asset info (tests / callers that already have it). */
  asset?: CampaignAssetInfo;
}): Promise<EligibilityResult> {
  const { campaign, claimer, country } = args;
  const checks: EligibilityCheck[] = [];
  const status = campaignStatus(campaign);
  checks.push({
    id: "campaign",
    label: "Gift can be claimed now",
    result: status === "open" ? "pass" : "fail",
    detail:
      status === "open"
        ? "Open, with slots left."
        : status === "locked"
          ? `Opens ${new Date(campaign.unlockAt * 1000).toUTCString()}.`
          : status === "full"
            ? "All slots have been claimed."
            : status === "expired"
              ? "This gift has expired; unclaimed funds go back to the sender."
              : "The sender closed this gift.",
  });

  if (claimer) {
    const self = claimer.toLowerCase() === campaign.creator.toLowerCase();
    checks.push({
      id: "self",
      label: "You're not the sender",
      result: self ? "fail" : "pass",
      detail: self ? "Senders can't claim their own gift." : "OK.",
    });
    const already = await hasClaimedOnchain(args.campaignId, claimer).catch(() => false);
    checks.push({
      id: "already",
      label: "This wallet hasn't claimed yet",
      result: already ? "fail" : "pass",
      detail: already ? "One claim per wallet — this wallet already claimed." : "OK.",
    });
  }

  const asset = args.asset ?? (await describeCampaignAsset(campaign.token));
  if (asset.regulated) {
    const { complianceConfig, evaluateRegionCompliance, fetchRemoteKillSwitch } = await import("@/src/config/compliance");
    const killed = await fetchRemoteKillSwitch().catch(() => false);
    checks.push({
      id: "killswitch",
      label: "Tokenized stock gifts are running",
      result: killed ? "fail" : "pass",
      detail: killed ? "Paused by the safety kill switch." : "OK.",
    });
    const enabled = Boolean(complianceConfig.features["stocks.vouchers"]);
    checks.push({
      id: "feature",
      label: "Stock gifts enabled",
      result: enabled ? "pass" : "fail",
      detail: enabled ? "OK." : "Tokenized stock vouchers are currently disabled.",
    });
    const region = evaluateRegionCompliance(country, "stocks.vouchers");
    // Fail closed: if the region can't be verified, a stock gift can't be claimed.
    const blocked = !country || (region.isRestricted && !region.canEnter);
    checks.push({
      id: "region",
      label: "Tokenized stocks available in your region",
      result: blocked ? "fail" : "pass",
      detail: !country
        ? "Your region couldn't be verified, so this stock gift can't be claimed here. Your share stays in escrow and goes back to the sender."
        : blocked
          ? `Not available in your region (${country}). Your share stays in escrow and goes back to the sender.`
          : `Region ${country}: allowed.`,
    });
  }

  if (claimer) {
    const { screenWalletAddress } = await import("@/lib/compliance/sanctions");
    const s = await screenWalletAddress(claimer).catch(() => null);
    checks.push({
      id: "sanctions",
      label: "Wallet sanctions screen",
      result: !s || s.provider === "disabled" ? "skipped" : s.isSanctioned ? "fail" : "pass",
      detail:
        !s || s.provider === "disabled"
          ? "Not configured on this deployment."
          : s.isSanctioned
            ? "This wallet can't receive this gift."
            : `Clear (${s.provider}).`,
    });
  }

  const firstFail = checks.find((c) => c.result === "fail") ?? null;
  return { eligible: !firstFail, checks, reason: firstFail?.detail ?? null };
}

export function countryFromRequest(req: Request): string | null {
  // On Vercel x-vercel-ip-country is set by the edge and can't be spoofed by the client.
  // x-user-country is only honoured outside Vercel (local dev / tests).
  const vercel = req.headers.get("x-vercel-ip-country");
  if (vercel) return vercel;
  const cf = req.headers.get("cf-ipcountry");
  if (cf) return cf;
  if (process.env.VERCEL) return null;
  return req.headers.get("x-user-country");
}
