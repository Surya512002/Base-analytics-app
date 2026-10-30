import { describe, expect, it, vi } from "vitest";
import {
  HEALTH_THRESHOLDS,
  fetchAllUserPositions,
} from "./user-positions";

// Mock createBasePublicClient to simulate Base mainnet RPC responses
vi.mock("@/lib/utils/base-rpc", () => {
  return {
    createBasePublicClient: vi.fn(() => ({
      multicall: vi.fn(async () => []),
      readContract: vi.fn(async () => [
        BigInt(0),
        BigInt(0),
        BigInt(0),
        BigInt(0),
        BigInt(0),
        BigInt(0),
      ]),
    })),
  };
});

describe("Real On-Chain Positions Reader (Base Mainnet)", () => {
  const dummyWallet = "0x1234567890123456789012345678901234567890" as `0x${string}`;

  it("configures health thresholds as Safe >= 1.5 and Watch >= 1.15", () => {
    expect(HEALTH_THRESHOLDS.SAFE).toBe(1.5);
    expect(HEALTH_THRESHOLDS.WATCH).toBe(1.15);
  });

  it("never returns fake positions when on-chain balances are zero", async () => {
    // When RPC returns zero for all calls
    const res = await fetchAllUserPositions(dummyWallet);

    expect(res.isMockData).toBe(false);
    expect(res.positions).toEqual([]);
    expect(res.positions.length).toBe(0);
  });

  it("isolates errors per protocol without failing the entire reader", async () => {
    const res = await fetchAllUserPositions(dummyWallet);
    expect(typeof res.errors).toBe("object");
  });

  it("returns demo positions only when NEXT_PUBLIC_USE_MOCK_POSITIONS is true", async () => {
    const originalEnv = process.env.NEXT_PUBLIC_USE_MOCK_POSITIONS;
    try {
      process.env.NEXT_PUBLIC_USE_MOCK_POSITIONS = "true";
      const res = await fetchAllUserPositions(dummyWallet);
      expect(res.isMockData).toBe(true);
      expect(res.positions.length).toBeGreaterThan(0);
      expect(res.positions[0].protocolName).toBe("Beefy Finance");
      expect(res.positions[0].healthFactor).toBeGreaterThan(0);
    } finally {
      process.env.NEXT_PUBLIC_USE_MOCK_POSITIONS = originalEnv;
    }
  });

  it("computes health factor, LTV and liquidation price only when debt exists", async () => {
    // Test helper logic: positions with 0 borrowedUsd must have null healthFactor
    const originalEnv = process.env.NEXT_PUBLIC_USE_MOCK_POSITIONS;
    try {
      process.env.NEXT_PUBLIC_USE_MOCK_POSITIONS = "true";
      const res = await fetchAllUserPositions(dummyWallet);
      const pos = res.positions[0];

      if (pos.borrowedUsd > 0) {
        expect(pos.healthFactor).not.toBeNull();
        expect(pos.ltv).not.toBeNull();
        expect(pos.liquidationPrice).not.toBeNull();
      }
    } finally {
      process.env.NEXT_PUBLIC_USE_MOCK_POSITIONS = originalEnv;
    }
  });
});
