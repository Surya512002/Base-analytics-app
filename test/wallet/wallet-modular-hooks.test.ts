import { describe, it, expect, vi } from "vitest";
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
        } as any,
      } as any)
    ).toBe(false);

    // Incomplete history: requires refresh
    expect(
      analysisNeedsActivityRefresh({
        historyComplete: false,
        wallet: { address: "0x1111111111111111111111111111111111111111" } as any,
      } as any)
    ).toBe(true);

    // Placeholder syncing text: requires refresh
    expect(
      analysisNeedsActivityRefresh({
        historyComplete: true,
        wallet: {
          address: "0x1111111111111111111111111111111111111111",
          recommendation: "Fetching onchain data…",
        } as any,
      } as any)
    ).toBe(true);
  });

  it("resolves default tab safely without window error", () => {
    const tab = resolveInitialTab();
    expect(["launchpad", "swap", "lend", "profile", "basehub"]).toContain(tab);
  });
});
