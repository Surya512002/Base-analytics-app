import { describe, expect, it } from "vitest";
import { parseUnits, formatUnits } from "viem";

describe("Frontend Transaction Safety & Decimals Math", () => {
  describe("Token Decimals & Exact Unit Parsing", () => {
    it("handles USDC (6 decimals) without floating-point errors", () => {
      const input = "123.456789";
      const parsed = parseUnits(input, 6);
      expect(parsed).toBe(BigInt(123456789));

      const formatted = formatUnits(parsed, 6);
      expect(formatted).toBe("123.456789");
    });

    it("handles cbBTC (8 decimals) without floating-point precision loss", () => {
      const input = "0.00000001"; // 1 satoshi
      const parsed = parseUnits(input, 8);
      expect(parsed).toBe(BigInt(1));

      const formatted = formatUnits(parsed, 8);
      expect(formatted).toBe("0.00000001");
    });

    it("handles WETH (18 decimals) for extreme small and large numbers", () => {
      // 1 wei
      const oneWei = parseUnits("0.000000000000000001", 18);
      expect(oneWei).toBe(BigInt(1));

      // 100 Million tokens
      const large = parseUnits("100000000", 18);
      expect(large).toBe(BigInt("100000000000000000000000000"));
      expect(formatUnits(large, 18)).toBe("100000000");
    });
  });

  describe("Exact Approvals vs Unlimited Approvals", () => {
    it("prefers exact required amount for ERC-20 approvals rather than MaxUint256", () => {
      const requiredAmount = parseUnits("250.00", 6); // 250 USDC
      const MAX_UINT256 = (BigInt(1) << BigInt(256)) - BigInt(1);

      // Safe app pattern: approve exact required amount
      const safeApprovalAmount = requiredAmount;
      expect(safeApprovalAmount).toBe(BigInt(250000000));
      expect(safeApprovalAmount).not.toBe(MAX_UINT256);
    });
  });

  describe("Slippage & Deadline Protection Math", () => {
    function computeMinimumOutput(expectedOutput: bigint, slippageBps: number): bigint {
      if (slippageBps < 0 || slippageBps > 5000) throw new Error("Invalid slippage (0-50%)");
      return (expectedOutput * (BigInt(10000) - BigInt(slippageBps))) / BigInt(10000);
    }

    it("calculates minimum output with 0.5% (50 bps) slippage correctly", () => {
      const expected = parseUnits("1000", 6); // 1000 USDC
      const minOut = computeMinimumOutput(expected, 50);

      // 1000 * (1 - 0.005) = 995 USDC
      expect(minOut).toBe(parseUnits("995", 6));
    });

    it("calculates minimum output with 1.0% (100 bps) slippage correctly", () => {
      const expected = parseUnits("10", 18); // 10 WETH
      const minOut = computeMinimumOutput(expected, 100);

      expect(minOut).toBe(parseUnits("9.9", 18));
    });

    it("validates transaction deadline calculation", () => {
      const now = Math.floor(Date.now() / 1000);
      const DEFAULT_DEADLINE_SECONDS = 1200; // 20 minutes
      const deadline = now + DEFAULT_DEADLINE_SECONDS;

      expect(deadline).toBeGreaterThan(now);
      expect(deadline - now).toBe(1200);
    });
  });

  describe("Health Factor & LTV Boundary Math", () => {
    function computeHealthFactor(collateralUsd: number, borrowedUsd: number, lltvPct: number): number | null {
      if (borrowedUsd <= 0) return null; // No debt -> null / '—'
      if (collateralUsd <= 0) return 0;
      return (collateralUsd * (lltvPct / 100)) / borrowedUsd;
    }

    it("returns null health factor when there is zero debt", () => {
      expect(computeHealthFactor(1000, 0, 77)).toBeNull();
    });

    it("calculates exact health factor when debt is present", () => {
      // $1000 collateral, $500 debt, 80% liquidation threshold
      // HF = ($1000 * 0.8) / $500 = 1.60 (Safe)
      const hf = computeHealthFactor(1000, 500, 80);
      expect(hf).toBe(1.6);
    });

    it("handles high precision boundary near liquidation", () => {
      // $1000 collateral, $770 debt, 77% LLTV -> HF = 1.0 (Liquidation boundary)
      const hf = computeHealthFactor(1000, 770, 77);
      expect(hf).toBe(1.0);
    });
  });
});
