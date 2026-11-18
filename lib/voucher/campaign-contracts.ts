/**
 * Which BaseVoucherCampaign contract a campaign lives on, from its id alone.
 *
 * v2 numbers campaigns from 1 (max 1,000 claims each). v3 numbers them from
 * 1,000,000,001 (max 1,000,000 claims), so the id says which contract it is on, and share
 * links (`/claim/{id}#k=…`) keep working unchanged after the upgrade.
 *
 * Configuration:
 *   NEXT_PUBLIC_CAMPAIGN_CONTRACT         where NEW one-link gifts are created (v3 once deployed)
 *   NEXT_PUBLIC_CAMPAIGN_CONTRACT_LEGACY  the previous (v2) contract, still claimable/refundable
 * With only the first set (today), every id resolves to it, exactly as before.
 */
import { CAMPAIGN_CONTRACT } from "@/lib/constants/env";

export const V3_FIRST_CAMPAIGN_ID = BigInt(1_000_000_001);

type Addr = `0x${string}`;
const RAW_LEGACY = (process.env.NEXT_PUBLIC_CAMPAIGN_CONTRACT_LEGACY || "").trim();
export const CAMPAIGN_CONTRACT_LEGACY: Addr | "" = /^0x[0-9a-fA-F]{40}$/.test(RAW_LEGACY) ? (RAW_LEGACY as Addr) : "";

/** True once a newer contract is configured alongside the previous one. */
export const hasLegacyCampaignContract = (): boolean =>
  Boolean(CAMPAIGN_CONTRACT_LEGACY && CAMPAIGN_CONTRACT && CAMPAIGN_CONTRACT_LEGACY.toLowerCase() !== CAMPAIGN_CONTRACT.toLowerCase());

/** The contract holding campaign `id`, or null when none is configured for that range. */
export function contractForCampaignId(id: bigint | number | string): Addr | null {
  let n: bigint;
  try {
    n = BigInt(id);
  } catch {
    return null;
  }
  if (n <= BigInt(0)) return null;
  if (hasLegacyCampaignContract()) {
    return n >= V3_FIRST_CAMPAIGN_ID ? (CAMPAIGN_CONTRACT as Addr) : (CAMPAIGN_CONTRACT_LEGACY as Addr);
  }
  return CAMPAIGN_CONTRACT || null;
}

/** Every configured campaign contract with the first id it issues (for scans by creator). */
export function campaignContracts(): Array<{ address: Addr; firstId: bigint }> {
  const out: Array<{ address: Addr; firstId: bigint }> = [];
  if (hasLegacyCampaignContract()) out.push({ address: CAMPAIGN_CONTRACT_LEGACY as Addr, firstId: BigInt(1) });
  if (CAMPAIGN_CONTRACT) out.push({ address: CAMPAIGN_CONTRACT as Addr, firstId: hasLegacyCampaignContract() ? V3_FIRST_CAMPAIGN_ID : BigInt(1) });
  return out;
}

/** Claim cap of the contract new gifts are created on; v2's 1,000 until v3 is configured. */
export const V2_MAX_CLAIMS = 1000;
