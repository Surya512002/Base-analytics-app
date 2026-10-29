import { describe, it, expect } from "vitest";
import { isVerifiedBaseToken, findVerifiedToken } from "@/lib/swap/verified-tokens";
import { evaluateTokenSpam } from "@/lib/portfolio/spam-filter";
import { batchPriceTokens } from "@/lib/portfolio/pricing";
import { discoverWalletBalances } from "@/lib/portfolio/indexer";
import { getAddress } from "viem";

describe("Tradable Base Tokens & Fren Pet Portfolio Integration", () => {
  const FREN_PET_CA = "0xFF0C532FDB8Cd566Ae169C1CB157ff2Bdc83E105" as const;

  it("recognizes Fren Pet CA in catalog but does NOT grant blue checkmark (reserved for official stocks & top bluechips)", () => {
    // Only official tokenized stocks and top-tier bluechips get the verified blue tick
    expect(isVerifiedBaseToken(FREN_PET_CA)).toBe(false);
    expect(isVerifiedBaseToken(FREN_PET_CA.toLowerCase())).toBe(false);

    // However, it IS discovered in the tradable Base token catalog
    const token = findVerifiedToken(FREN_PET_CA);
    expect(token).toBeDefined();
    expect(token?.symbol).toBe("FP");
    expect(token?.name).toBe("Fren Pet");
    expect(token?.decimals).toBe(18);
  });

  it("does not flag Fren Pet as spam because it has high liquidity and verified status", () => {
    const spamCheck = evaluateTokenSpam({
      address: FREN_PET_CA,
      name: "Fren Pet",
      symbol: "FP",
      hasPool: true,
      liquidityUsd: 660_000,
    });
    expect(spamCheck.isSpam).toBe(false);
  });

  it("fetches active market price for Fren Pet CA", async () => {
    const priceMap = await batchPriceTokens([FREN_PET_CA]);
    const fpPrice = priceMap.get(FREN_PET_CA.toLowerCase());

    expect(fpPrice).toBeDefined();
    expect(fpPrice?.priceUsd).toBeGreaterThan(0);
    expect(["defillama", "dexscreener"]).toContain(fpPrice?.priceSource);
    expect(fpPrice?.hasPool).toBe(true);
  });

  it("discovers Fren Pet on-chain for addresses holding it without depending on external indexers", async () => {
    // Address known to hold Fren Pet (BaseSwap Pair)
    const holder = getAddress("0x29b3a7869E3662D00aaBD89A8ee74B2F703a6a66");
    const result = await discoverWalletBalances(holder);

    expect(result.balances.length).toBeGreaterThan(0);
    const fpBalance = result.balances.find(
      (b) => b.address.toLowerCase() === FREN_PET_CA.toLowerCase()
    );

    expect(fpBalance).toBeDefined();
    expect(fpBalance?.symbol).toBe("FP");
    expect(fpBalance?.name).toBe("Fren Pet");
    expect(fpBalance?.decimals).toBe(18);
    expect(fpBalance?.balanceBigInt).toBeGreaterThan(BigInt(0));
  });
});
