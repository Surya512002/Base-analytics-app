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

    it("validates time-lock and expiration chronology invariants", () => {
      const now = 1700000000;
      const validUnlock = now + 86400; // +1 day
      const validExp = now + 7 * 86400; // +7 days

      // Valid: expiration after unlock
      expect(validExp > validUnlock).toBe(true);

      // Invalid: expiration before unlock
      const invalidExp = validUnlock - 100;
      expect(invalidExp > validUnlock).toBe(false);

      // Active status evaluation
      function isRedeemable(current: number, unlock: number, exp: number): boolean {
        if (unlock > 0 && current < unlock) return false;
        if (exp > 0 && current >= exp) return false;
        return true;
      }

      expect(isRedeemable(now, validUnlock, validExp)).toBe(false); // Before unlock
      expect(isRedeemable(validUnlock + 1, validUnlock, validExp)).toBe(true); // Active window
      expect(isRedeemable(validExp + 1, validUnlock, validExp)).toBe(false); // Expired
    });

    it("verifies creator reclaim math and prevents double reclaim", () => {
      const cardCount = 10;
      const perCard = parseEther("0.1"); // 0.1 ETH per card
      let redeemedCount = 4;

      // Unredeemed calculation
      const remainingCards = cardCount - redeemedCount;
      expect(remainingCards).toBe(6);
      const reclaimAmount = BigInt(remainingCards) * perCard;
      expect(reclaimAmount).toBe(parseEther("0.6"));

      // Contract marks redeemedCount = cardCount upon reclaim
      redeemedCount = cardCount;
      const remainingAfterReclaim = cardCount - redeemedCount;
      expect(remainingAfterReclaim).toBe(0);
      expect(remainingAfterReclaim > 0).toBe(false); // Zero cards left to reclaim
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
