import { describe, expect, it } from "vitest";
import {
  computeScoreComponents,
  computeTotalScore,
  computeWalletRank,
} from "@/lib/utils/score";

describe("computeWalletRank", () => {
  it("maps score bands", () => {
    expect(computeWalletRank(0)).toBe("Base Shrimp 🦐");
    expect(computeWalletRank(24)).toBe("Base Shrimp 🦐");
    expect(computeWalletRank(25)).toBe("Base Dolphin 🐬");
    expect(computeWalletRank(45)).toBe("Base Shark 🦈");
    expect(computeWalletRank(65)).toBe("Base Whale 🐋");
    expect(computeWalletRank(82)).toBe("Base God 👑");
  });
});

describe("computeScoreComponents — high-volume trader", () => {
  it("clears Dolphin when eth + swap cards match an active trader", () => {
    const components = computeScoreComponents({
      txCount: 200,
      uniqueDays: 9,
      activeMonths: 0,
      activeWeeks: 0,
      currentStreak: 0,
      longestStreak: 0,
      ethVol: 6.3965,
      uniqueTokens: 1,
      defiInteractions: 0,
      uniqueContracts: 0,
      nftCount: 0,
      nftTxCount: 0,
      dexTradeCount: 1718,
      dexVolumeUSD: 23100,
      ethSwapVolumeUSD: 1420,
      bridgeTxCount: 0,
      hasBasename: true,
      gmCount: 0,
      checkInCount: 0,
    });
    const score = computeTotalScore(components);
    expect(components.volume).toBeGreaterThan(5);
    expect(components.dexTrading).toBeGreaterThan(5);
    expect(components.txActivity).toBeGreaterThan(6);
    expect(score).toBeGreaterThanOrEqual(25);
    expect(computeWalletRank(score)).toBe("Base Dolphin 🐬");
  });
});
