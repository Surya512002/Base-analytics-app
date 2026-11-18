"use client";

import { useEffect, useState } from "react";

export type CampaignConfig = {
  ready: boolean;
  contract?: string | null;
  /** MAX_CLAIMS of the contract new one-link gifts go to (1,000 on v2, 1,000,000 on v3). */
  maxClaims?: number;
  claimSigner: string | null;
  verifiedClaimsAvailable: boolean;
};

const FALLBACK: CampaignConfig = { ready: false, claimSigner: null, verifiedClaimsAvailable: false };

// One request per page load, shared by every component that needs it.
let pending: Promise<CampaignConfig> | null = null;
function loadConfig(): Promise<CampaignConfig> {
  pending ??= fetch("/api/voucher/campaign/config", { cache: "no-store" })
    .then((r) => r.json() as Promise<CampaignConfig>)
    .catch(() => {
      pending = null; // allow a retry on the next mount
      return FALLBACK;
    });
  return pending;
}

/** One-link (campaign) config: whether it's live, its claim cap and claim signer. */
export function useCampaignConfig(): CampaignConfig | null {
  const [cfg, setCfg] = useState<CampaignConfig | null>(null);
  useEffect(() => {
    let live = true;
    loadConfig().then((c) => live && setCfg(c));
    return () => {
      live = false;
    };
  }, []);
  return cfg;
}
