import { BLUE_CHECK_VERIFIED_ADDRESS_SET } from "@/lib/swap/verified-tokens";
import type { SmartMoneyBuyEvent } from "@/lib/smart-money/smart-money-store";

export const RADAR_MAX_EVENTS = 8;

/** One entry of Alchemy's alchemy_getAssetTransfers result (only the fields read here). */
export interface RadarTransfer {
  hash: string;
  asset?: string | null;
  value?: number | null;
  rawContract?: { address?: string | null };
  metadata?: { blockTimestamp?: string };
}

/**
 * Anyone can send any token to a wallet, so only verified tokens are listed: a spam airdrop must
 * never appear here next to a Swap button.
 */
export function radarEvents(transfers: ReadonlyArray<RadarTransfer>, wallet: string, label: string): SmartMoneyBuyEvent[] {
  return transfers
    .flatMap((t) => {
      const token = t.rawContract?.address?.toLowerCase();
      if (!token || !BLUE_CHECK_VERIFIED_ADDRESS_SET.has(token) || !t.value || t.value <= 0) return [];
      const at = t.metadata?.blockTimestamp ? Date.parse(t.metadata.blockTimestamp) : NaN;
      return [
        {
          txHash: t.hash,
          walletAddress: wallet,
          walletLabel: label,
          tokenAddress: token,
          tokenSymbol: t.asset || "TOKEN",
          amount: t.value.toLocaleString("en-US", { maximumFractionDigits: t.value >= 1000 ? 2 : 4 }),
          usdValue: null,
          timestamp: Number.isFinite(at) ? at : 0,
        },
      ];
    })
    .slice(0, RADAR_MAX_EVENTS);
}
