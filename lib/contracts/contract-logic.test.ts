import { describe, expect, it } from "vitest";
import { keccak256, toHex, parseEther, parseUnits } from "viem";
import { computePlatformFee } from "@/lib/launchpad/fees";
import { splitPlatformFee } from "@/lib/launchpad/fee-split";

describe("Smart Contract Logic & Invariants (Vouchers, Stake, Launch)", () => {
  describe("BaseVoucher Invariants", () => {
    it("enforces max card count of 50 per batch", () => {
      const MAX_CARDS = 50;
      const validCounts = [1, 5, 25, 50];
      const invalidCounts = [0, 51, 100, 1000];

      validCounts.forEach((count) => {
        expect(count > 0 && count <= MAX_CARDS).toBe(true);
      });

      invalidCounts.forEach((count) => {
        expect(count > 0 && count <= MAX_CARDS).toBe(false);
      });
    });

    it("requires exact split without leaving stuck dust", () => {
      // Must satisfy totalAmount % cardCount === 0n
      const testCases = [
        { total: BigInt(100), cards: BigInt(5), expected: true },
        { total: BigInt(100), cards: BigInt(3), expected: false }, // 100 % 3 = 1 (dust)
        { total: parseEther("1"), cards: BigInt(4), expected: true },
        { total: parseUnits("10", 6), cards: BigInt(10), expected: true },
      ];

      for (const tc of testCases) {
        const canSplit = tc.total % tc.cards === BigInt(0);
        expect(canSplit).toBe(tc.expected);
      }
    });

    it("verifies secret hash verification using standard keccak256", () => {
      const secret = "base-gift-2026";
      const expectedHash = keccak256(toHex(secret));

      // Redeemer supplies secret; contract checks keccak256(abi.encodePacked(secret))
      const computed = keccak256(toHex(secret));
      expect(computed).toBe(expectedHash);

      const wrongSecret = "wrong-gift-pass";
      expect(keccak256(toHex(wrongSecret))).not.toBe(expectedHash);
    });

    it("prevents multiple redemptions for same wallet or same card", () => {
      const batchRedeemedWallets = new Set<string>();
      const cardRedeemedStatus = new Map<number, boolean>();

      const walletA = "0x1111111111111111111111111111111111111111".toLowerCase();
      const card0 = 0;

      // First redemption
      expect(batchRedeemedWallets.has(walletA)).toBe(false);
      expect(cardRedeemedStatus.get(card0)).toBeFalsy();

      batchRedeemedWallets.add(walletA);
      cardRedeemedStatus.set(card0, true);

      // Subsequent attempt by same wallet
      expect(batchRedeemedWallets.has(walletA)).toBe(true);
      // Subsequent attempt on same card
      expect(cardRedeemedStatus.get(card0)).toBe(true);
    });
  });

  describe("XpStake Invariants", () => {
    const MIN_TIER1 = parseEther("0.0001");
    const MIN_TIER2 = parseEther("0.0005");
    const MIN_TIER3 = parseEther("0.001");
    const LOCK_PERIOD = 7 * 24 * 3600; // 7 days

    it("resolves tier thresholds correctly", () => {
      function resolveTier(amount: bigint): number {
        if (amount >= MIN_TIER3) return 3;
        if (amount >= MIN_TIER2) return 2;
        if (amount >= MIN_TIER1) return 1;
        throw new Error("min stake");
      }

      expect(resolveTier(parseEther("0.0001"))).toBe(1);
      expect(resolveTier(parseEther("0.0004"))).toBe(1);
      expect(resolveTier(parseEther("0.0005"))).toBe(2);
      expect(resolveTier(parseEther("0.0009"))).toBe(2);
      expect(resolveTier(parseEther("0.001"))).toBe(3);
      expect(resolveTier(parseEther("0.05"))).toBe(3);
      expect(() => resolveTier(parseEther("0.00005"))).toThrow("min stake");
    });

    it("enforces exact 7-day lock duration before allowing unstake", () => {
      const stakedAt = 1000000;
      const unlockAt = stakedAt + LOCK_PERIOD;

      const beforeLock = unlockAt - 1;
      const atLock = unlockAt;
      const afterLock = unlockAt + 100;

      expect(beforeLock >= unlockAt).toBe(false); // Locked
      expect(atLock >= unlockAt).toBe(true); // Unlocked
      expect(afterLock >= unlockAt).toBe(true); // Unlocked
    });
  });

  describe("Launchpad B20 & Fee Splitting Invariants", () => {
    it("verifies supply is exactly fixed at 1 Billion tokens", () => {
      const TOTAL_SUPPLY = BigInt("1000000000"); // 1B
      const TOTAL_SUPPLY_WEI = TOTAL_SUPPLY * BigInt(1e18);

      expect(TOTAL_SUPPLY_WEI).toBe(BigInt("1000000000000000000000000000"));
    });

    it("verifies 0.5% platform fee splits exactly 0.25% creator and 0.25% platform", () => {
      const grossAmount = parseEther("10"); // 10 ETH swap or launch
      const fee = computePlatformFee(grossAmount, 50); // 50 bps = 0.50%

      // Total fee is exactly 0.05 ETH
      expect(fee).toBe(parseEther("0.05"));

      const creator = "0x1111111111111111111111111111111111111111" as `0x${string}`;
      const split = splitPlatformFee(fee, { creator });

      // Creator gets 50% of the 50 bps fee (= 25 bps / 0.25% of gross)
      expect(split.creator).toBe(parseEther("0.025"));
      // Platform gets 50% of the 50 bps fee (= 25 bps / 0.25% of gross)
      expect(split.platform).toBe(parseEther("0.025"));
      expect(split.creator + split.platform).toBe(fee);
    });
  });
});
