/**
 * Pluggable Sanctions Screening Module
 *
 * NOTE: These are product safeguards pending legal review, not legal advice.
 * This module is disabled by default until counsel and engineering select and configure
 * an approved sanctions screening vendor.
 */

import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { complianceConfig } from "@/src/config/compliance";

export type SanctionsProviderId = "chainalysis_oracle" | "trm_labs" | "elliptic" | "mock";

export interface SanctionsCheckResult {
  isSanctioned: boolean;
  provider: SanctionsProviderId | "disabled";
  reason?: string;
  checkedAt: number;
}

export interface SanctionsProvider {
  id: SanctionsProviderId;
  name: string;
  screenAddress(address: `0x${string}`): Promise<SanctionsCheckResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Mock Provider (for Unit & Fork Tests)
// ─────────────────────────────────────────────────────────────────────────────
export const KNOWN_TEST_SANCTIONED_ADDRESSES = new Set<string>([
  "0x0000000000000000000000000000000000000bad".toLowerCase(),
  "0x7F367cC41522Ce07553e8435b8b4f7257bd4A020".toLowerCase(), // OFAC flagged tornado mixer relayer (well-known public address)
]);

export class MockSanctionsProvider implements SanctionsProvider {
  id: SanctionsProviderId = "mock";
  name = "Mock Sanctions Provider";

  async screenAddress(address: `0x${string}`): Promise<SanctionsCheckResult> {
    const isSanctioned = KNOWN_TEST_SANCTIONED_ADDRESSES.has(address.toLowerCase());
    return {
      isSanctioned,
      provider: "mock",
      reason: isSanctioned ? "Address listed in mock sanctions database" : undefined,
      checkedAt: Date.now(),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Chainalysis Onchain Oracle Provider (Base Mainnet)
//
// Evaluated Provider: Chainalysis Sanctions Oracle
// Mechanism: Smart contract deployed on EVM chains containing OFAC SDN list hashes.
// Method: isSanctioned(address) view returns (bool)
// Availability on Base: Chainalysis provides an on-chain oracle contract for Base.
// Note: Contract address should be verified from official Chainalysis documentation
//       (docs.chainalysis.com) and configured via CHAINALYSIS_SANCTIONS_ORACLE_BASE.
// ─────────────────────────────────────────────────────────────────────────────
const CHAINALYSIS_ORACLE_ABI = [
  {
    name: "isSanctioned",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export class ChainalysisOracleProvider implements SanctionsProvider {
  id: SanctionsProviderId = "chainalysis_oracle";
  name = "Chainalysis Onchain Sanctions Oracle";

  private contractAddress?: `0x${string}`;

  constructor(customAddress?: `0x${string}`) {
    const envAddr = process.env.CHAINALYSIS_SANCTIONS_ORACLE_BASE as `0x${string}` | undefined;
    this.contractAddress = customAddress || envAddr;
  }

  async screenAddress(address: `0x${string}`): Promise<SanctionsCheckResult> {
    if (!this.contractAddress) {
      // Contract address not verified or configured; fail safe without blocking user funds
      return {
        isSanctioned: false,
        provider: "chainalysis_oracle",
        reason: "Oracle contract address not configured in environment (CHAINALYSIS_SANCTIONS_ORACLE_BASE)",
        checkedAt: Date.now(),
      };
    }

    try {
      const publicClient = createBasePublicClient();
      const isSanctioned = (await publicClient.readContract({
        address: this.contractAddress,
        abi: CHAINALYSIS_ORACLE_ABI,
        functionName: "isSanctioned",
        args: [address],
      })) as boolean;

      return {
        isSanctioned,
        provider: "chainalysis_oracle",
        reason: isSanctioned ? "Address flagged by Chainalysis on-chain sanctions oracle" : undefined,
        checkedAt: Date.now(),
      };
    } catch (err) {
      console.error("[sanctions/chainalysis] Oracle read failed:", err);
      // Fail open for standard reads if oracle node experiences outage, logged for security monitoring
      return {
        isSanctioned: false,
        provider: "chainalysis_oracle",
        reason: "Oracle query error (fail open for non-custodial interface)",
        checkedAt: Date.now(),
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TRM Labs API Provider
//
// Evaluated Provider: TRM Labs Screening API
// Mechanism: REST API (POST /public/v1/sanctions/screening)
// Terms: Free tier or enterprise contract depending on volume.
// Requires: TRM_API_KEY environment variable.
// ─────────────────────────────────────────────────────────────────────────────
export class TrmLabsProvider implements SanctionsProvider {
  id: SanctionsProviderId = "trm_labs";
  name = "TRM Labs Sanctions Screening API";

  async screenAddress(address: `0x${string}`): Promise<SanctionsCheckResult> {
    const apiKey = process.env.TRM_API_KEY;
    if (!apiKey) {
      return {
        isSanctioned: false,
        provider: "trm_labs",
        reason: "TRM_API_KEY not configured",
        checkedAt: Date.now(),
      };
    }

    try {
      const res = await fetch("https://api.trmlabs.com/public/v1/sanctions/screening", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${apiKey}:${apiKey}`).toString("base64")}`,
        },
        body: JSON.stringify([{ address, chain: "base" }]),
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) {
        return {
          isSanctioned: false,
          provider: "trm_labs",
          reason: `TRM API error: ${res.status}`,
          checkedAt: Date.now(),
        };
      }

      const data = (await res.json()) as Array<{
        isSanctioned?: boolean;
        entities?: Array<{ riskRule: string }>;
      }>;

      const isSanctioned = Boolean(data?.[0]?.isSanctioned);
      return {
        isSanctioned,
        provider: "trm_labs",
        reason: isSanctioned ? "Address flagged in TRM Labs sanctions screening" : undefined,
        checkedAt: Date.now(),
      };
    } catch (err) {
      console.error("[sanctions/trm] API request failed:", err);
      return {
        isSanctioned: false,
        provider: "trm_labs",
        reason: "TRM request error",
        checkedAt: Date.now(),
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Elliptic Provider
//
// Evaluated Provider: Elliptic Holistic Screening
// Mechanism: REST API (POST /v2/wallet/synchronous)
// Requires: ELLIPTIC_API_KEY environment variable.
// ─────────────────────────────────────────────────────────────────────────────
export class EllipticProvider implements SanctionsProvider {
  id: SanctionsProviderId = "elliptic";
  name = "Elliptic Wallet Screening API";

  async screenAddress(address: `0x${string}`): Promise<SanctionsCheckResult> {
    const apiKey = process.env.ELLIPTIC_API_KEY;
    if (!apiKey) {
      return {
        isSanctioned: false,
        provider: "elliptic",
        reason: "ELLIPTIC_API_KEY not configured",
        checkedAt: Date.now(),
      };
    }

    try {
      const res = await fetch("https://api.elliptic.co/v2/wallet/synchronous", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-access-key": apiKey,
        },
        body: JSON.stringify({
          subject: {
            asset: "ETH",
            type: "address",
            hash: address,
          },
        }),
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) {
        return {
          isSanctioned: false,
          provider: "elliptic",
          reason: `Elliptic API error: ${res.status}`,
          checkedAt: Date.now(),
        };
      }

      const data = (await res.json()) as { risk_score?: number };
      const isSanctioned = typeof data.risk_score === "number" && data.risk_score >= 8.0;

      return {
        isSanctioned,
        provider: "elliptic",
        reason: isSanctioned ? "Address risk score exceeds sanctions threshold" : undefined,
        checkedAt: Date.now(),
      };
    } catch (err) {
      console.error("[sanctions/elliptic] API request failed:", err);
      return {
        isSanctioned: false,
        provider: "elliptic",
        reason: "Elliptic request error",
        checkedAt: Date.now(),
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry & Screening Router
// ─────────────────────────────────────────────────────────────────────────────
export function getSanctionsProvider(providerId?: SanctionsProviderId): SanctionsProvider {
  const chosen = providerId || complianceConfig.sanctions.provider;
  switch (chosen) {
    case "chainalysis_oracle":
      return new ChainalysisOracleProvider();
    case "trm_labs":
      return new TrmLabsProvider();
    case "elliptic":
      return new EllipticProvider();
    case "mock":
    default:
      return new MockSanctionsProvider();
  }
}

/**
 * Screen a wallet address against sanctions lists.
 * Returns immediately if sanctions screening is disabled in config.
 */
export async function screenWalletAddress(
  address: string | null | undefined
): Promise<SanctionsCheckResult> {
  const isEnabled =
    process.env.COMPLIANCE_SANCTIONS_SCREENING_ENABLED === "true" ||
    complianceConfig.sanctions.enabled;

  if (!isEnabled || !address || !address.startsWith("0x")) {
    return {
      isSanctioned: false,
      provider: "disabled",
      checkedAt: Date.now(),
    };
  }

  const provider = getSanctionsProvider();
  return provider.screenAddress(address as `0x${string}`);
}
