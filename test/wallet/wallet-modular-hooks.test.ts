import { describe, it, expect } from "vitest";
import type { WalletData } from "@/lib/types/wallet";
import {
  analysisNeedsActivityRefresh,
  resolveInitialTab,
} from "@/hooks/wallet/wallet-utils";

describe("Wallet Modular Hooks & Controller Utilities", () => {
  it("determines whether wallet analysis requires background activity refresh", () => {
    // Complete history with recent transactions: no refresh needed
    expect(
      analysisNeedsActivityRefresh({
        historyComplete: true,
        wallet: {
          address: "0x1111111111111111111111111111111111111111",
          recommendation: "Active Trader",
          txCount: 5,
          recentTxs: [{ hash: "0x123", timeAgo: "1h", type: "swap", summary: "Swapped ETH for USDC" }],
          firstTx: "2024-01-01",
          lastTx: "2024-06-01",
        } as unknown as WalletData,
      })
    ).toBe(false);

    // Incomplete history: requires refresh
    expect(
      analysisNeedsActivityRefresh({
        historyComplete: false,
        wallet: { address: "0x1111111111111111111111111111111111111111" } as unknown as WalletData,
      })
    ).toBe(true);

    // Placeholder syncing text: requires refresh
    expect(
      analysisNeedsActivityRefresh({
        historyComplete: true,
        wallet: {
          address: "0x1111111111111111111111111111111111111111",
          recommendation: "Fetching onchain data…",
        } as unknown as WalletData,
      })
    ).toBe(true);
  });

  it("resolves default tab safely without window error", () => {
    const tab = resolveInitialTab();
    expect(["launchpad", "swap", "lend", "profile", "basehub"]).toContain(tab);
  });
});
