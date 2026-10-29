import { describe, it, expect } from "vitest";
import { feeBreakdownLabels, splitPlatformFee, FEE_SHARE_CREATOR_BPS, FEE_SHARE_PLATFORM_BPS } from "@/lib/launchpad/fee-split";
import { isAppLaunchedToken } from "@/lib/launchpad/token-store";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { OPENLAUNCH_LOCKER_BASE, OPENLAUNCH_FACTORY_BASE, BASE_STOCKS, getBaseStockBySymbol } from "@/lib/stocks/base-stocks";

describe("Token Launch & Fee Sharing System", () => {
  it("provides exact 0.50% total fee with 0.25% creator and 0.25% platform breakdown", () => {
    const labels = feeBreakdownLabels();
    expect(labels.totalFeeLabel).toBe("0.50%");
    expect(labels.creatorShareLabel).toBe("0.25%");
    expect(labels.platformShareLabel).toBe("0.25%");

    expect(FEE_SHARE_CREATOR_BPS).toBe(5000); // 50% of the 50 bps fee = 25 bps (0.25%)
    expect(FEE_SHARE_PLATFORM_BPS).toBe(5000); // 50% of the 50 bps fee = 25 bps (0.25%)
  });

  it("splits platform fee evenly between creator and treasury with zero referral dilution", () => {
    const creator = "0x1111111111111111111111111111111111111111" as const;
    const grossFee = BigInt(10_000_000); // e.g. 10m wei
    const split = splitPlatformFee(grossFee, { creator });

    expect(split.creator).toBe(BigInt(5_000_000));
    expect(split.platform).toBe(BigInt(5_000_000));
    expect(split.referrer).toBe(BigInt(0));

    // Validates transfers array contains creator payout
    const creatorTransfer = split.transfers.find(
      (t) => t.to.toLowerCase() === creator.toLowerCase()
    );
    expect(creatorTransfer).toBeDefined();
    expect(creatorTransfer?.amount).toBe(BigInt(5_000_000));
  });

  it("correctly identifies all 3 launched token types via isAppLaunchedToken", () => {
    const b20Token: LaunchedToken = {
      address: "0xb200000000000000000000111111111111111111",
      name: "B20 Vanity",
      symbol: "BVANITY",
      decimals: 18,
      creator: "0x1111111111111111111111111111111111111111",
      createdAt: Date.now(),
      txHash: "0xabc",
      source: "launched",
      tokenType: "b20",
    };

    const standardMemeToken: LaunchedToken = {
      address: "0x2222222222222222222222222222222222222222",
      name: "Doge Base",
      symbol: "DOGEB",
      decimals: 18,
      creator: "0x1111111111111111111111111111111111111111",
      createdAt: Date.now(),
      txHash: "0xdef",
      tokenType: "standard",
      liquidityLocked: true,
      lockerAddress: OPENLAUNCH_LOCKER_BASE,
    };

    const memestockToken: LaunchedToken = {
      address: "0x3333333333333333333333333333333333333333",
      name: "Nvidia Pepe",
      symbol: "NVPEPE",
      decimals: 18,
      creator: "0x1111111111111111111111111111111111111111",
      createdAt: Date.now(),
      txHash: "0x123",
      tokenType: "memestock",
      quoteAsset: "NVDAc",
      quoteAssetAddress: "0xb20000000000000000000078ee7ce2fe4908108c",
      quoteAssetSymbol: "NVDAc",
    };

    expect(isAppLaunchedToken(b20Token)).toBe(true);
    expect(isAppLaunchedToken(standardMemeToken)).toBe(true);
    expect(isAppLaunchedToken(memestockToken)).toBe(true);
    expect(isAppLaunchedToken(null)).toBe(false);
  });

  it("verifies OpenLaunch factory and locker addresses on Base", () => {
    expect(OPENLAUNCH_FACTORY_BASE).toBe("0x815542E8b392389A1389E22E588E4B62A67Ade72");
    expect(OPENLAUNCH_LOCKER_BASE).toBe("0xcd1680D26922fcd9CabFbb8a56bA40C333fD842a");
  });

  it("verifies stock quote asset lookups for Coinbase tokenized stocks", () => {
    const nvda = getBaseStockBySymbol("NVDAc");
    expect(nvda).toBeDefined();
    expect(nvda?.name).toContain("NVIDIA");
    expect(nvda?.decimals).toBe(8);
    expect(nvda?.address.toLowerCase()).toBe("0xb20000000000000000000078ee7ce2fe4908108c");

    const tsla = getBaseStockBySymbol("TSLAc");
    expect(tsla).toBeDefined();
    expect(tsla?.name).toContain("Tesla");
  });

  it("produces accurate badge labels and classes for memestocks, memes, and B20 tokens", async () => {
    const { tokenBadgeLabel, tokenBadgeClass } = await import("@/lib/launchpad/token-meta");

    const memestock: LaunchedToken = {
      address: "0x3333333333333333333333333333333333333333",
      name: "Tesla Doge",
      symbol: "TSLADOGE",
      decimals: 18,
      creator: "0x1111111111111111111111111111111111111111",
      createdAt: Date.now(),
      txHash: "0x123",
      tokenType: "memestock",
      quoteAsset: "TSLAc",
    };

    const standardMeme: LaunchedToken = {
      address: "0x4444444444444444444444444444444444444444",
      name: "Pepe Base",
      symbol: "PEPEB",
      decimals: 18,
      creator: "0x1111111111111111111111111111111111111111",
      createdAt: Date.now(),
      txHash: "0x456",
      tokenType: "standard",
    };

    const b20Token: LaunchedToken = {
      address: "0xb200000000000000000000111111111111111111",
      name: "Vanity B20",
      symbol: "VB20",
      decimals: 18,
      creator: "0x1111111111111111111111111111111111111111",
      createdAt: Date.now(),
      txHash: "0x789",
      source: "launched",
      tokenType: "b20",
    };

    expect(tokenBadgeLabel(memestock)).toBe("Stock · TSLAc");
    expect(tokenBadgeClass(memestock)).toContain("blue");

    expect(tokenBadgeLabel(standardMeme)).toBe("Meme Coin");
    expect(tokenBadgeClass(standardMeme)).toContain("purple");

    expect(tokenBadgeLabel(b20Token)).toBe("App · B20");
  });
});
