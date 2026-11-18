import { beforeEach, describe, expect, it, vi } from "vitest";

const multicall = vi.fn();
vi.mock("@/lib/utils/base-rpc", () => ({
  createBasePublicClient: vi.fn(() => ({ multicall })),
}));

const liveRates = vi.fn();
vi.mock("./unified-comparison", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./unified-comparison")>();
  return { ...actual, getLiveBeefyAndAeroRates: () => liveRates() };
});

import {
  formatLpAmount,
  readAerodromeGaugePositions,
  readBeefyPositions,
  valueBeefyVaultShares,
  valueLpTokens,
} from "./user-positions";
import {
  VERIFIED_BEEFY_STOCK_DETAILS,
  VERIFIED_BEEFY_STOCK_VAULTS,
  beefyLpOracleId,
} from "./unified-comparison";

const E18 = BigInt(10) ** BigInt(18);
const user = "0x1234567890123456789012345678901234567890" as const;
const ok = (result: bigint) => ({ status: "success" as const, result });
const fail = { status: "failure" as const, error: new Error("revert") };

type Call = { address: string; functionName: string };
/** Answer each multicall entry from a table keyed by `address:functionName` (lower-case address). */
function answerWith(table: Record<string, ReturnType<typeof ok> | typeof fail>) {
  multicall.mockImplementation(async ({ contracts }: { contracts: Call[] }) =>
    contracts.map((c) => table[`${c.address.toLowerCase()}:${c.functionName}`] ?? ok(BigInt(0)))
  );
}

beforeEach(() => {
  multicall.mockReset();
  liveRates.mockReset();
});

describe("LP valuation math", () => {
  it("values Beefy shares as shares × pricePerFullShare × LP price", () => {
    // 2 shares, 1.5 LP per share, $10 per LP → $30
    expect(valueBeefyVaultShares(BigInt(2) * E18, (BigInt(3) * E18) / BigInt(2), 10)).toBeCloseTo(30, 10);
  });

  it("matches a real Beefy CLM vault's onchain numbers", () => {
    // NVDAc vault on Base: totalSupply 70875491880, ppfs 1.0620743…, /lps 1.6664e12 → Beefy TVL ≈ $125k
    const usd = valueBeefyVaultShares(BigInt("70875491880"), BigInt("1062074340908263760"), 1666429678032.75);
    expect(usd).toBeGreaterThan(125_000);
    expect(usd).toBeLessThan(126_000);
  });

  it("returns null instead of guessing when a price is missing", () => {
    expect(valueBeefyVaultShares(E18, null, 10)).toBeNull();
    expect(valueBeefyVaultShares(E18, BigInt(0), 10)).toBeNull();
    expect(valueBeefyVaultShares(E18, E18, null)).toBeNull();
    expect(valueBeefyVaultShares(E18, E18, undefined)).toBeNull();
    expect(valueLpTokens(1, 0)).toBeNull();
    expect(valueLpTokens(1, Number.NaN)).toBeNull();
    expect(valueLpTokens(2.5, 4)).toBe(10);
  });

  it("formats tiny LP amounts with significant digits instead of 0.0000", () => {
    expect(formatLpAmount(1.23456)).toBe("1.2346");
    expect(formatLpAmount(0.00000007087549)).toBe("7.088e-8");
    expect(formatLpAmount(0)).toBe("0");
  });

  it("derives the Beefy LP oracle id from the vault id", () => {
    expect(beefyLpOracleId("aero-cow-base-usdc-nvdac-vault")).toBe("aero-cow-base-usdc-nvdac");
  });
});

describe("readBeefyPositions", () => {
  const nvdaVault = VERIFIED_BEEFY_STOCK_VAULTS.NVDAc!.toLowerCase();
  const aaplVault = VERIFIED_BEEFY_STOCK_VAULTS.AAPLc!.toLowerCase();

  it("values vault shares via pricePerFullShare and the LP price, not the stock price", async () => {
    liveRates.mockResolvedValue({ beefy: { NVDAc: { apy: 12, tvl: 0 } }, aerodrome: {}, lpPrices: { NVDAc: 1000 } });
    answerWith({
      [`${nvdaVault}:balanceOf`]: ok(BigInt(3) * E18),
      [`${nvdaVault}:getPricePerFullShare`]: ok((BigInt(11) * E18) / BigInt(10)),
    });

    const positions = await readBeefyPositions(user);
    expect(multicall).toHaveBeenCalledTimes(1);
    expect(positions).toHaveLength(1);
    const p = positions[0]!;
    expect(p.suppliedUsd).toBeCloseTo(3 * 1.1 * 1000, 6);
    expect(p.suppliedFormatted).toBe("3.0000 vault shares");
    expect(p.suppliedFormatted).not.toContain("NVDAc");
    expect(p.apy).toBe(12);
  });

  it("shows null USD when the LP price or share price can't be read", async () => {
    liveRates.mockResolvedValue({ beefy: {}, aerodrome: {}, lpPrices: { AAPLc: 50 } });
    answerWith({
      [`${nvdaVault}:balanceOf`]: ok(E18),
      [`${nvdaVault}:getPricePerFullShare`]: ok(E18),
      [`${aaplVault}:balanceOf`]: ok(E18),
      [`${aaplVault}:getPricePerFullShare`]: fail,
    });

    const positions = await readBeefyPositions(user);
    expect(positions.map((p) => [p.id, p.suppliedUsd])).toEqual([
      ["beefy-nvdac", null], // no LP price
      ["beefy-aaplc", null], // share price read failed
    ]);
  });
});

describe("readAerodromeGaugePositions", () => {
  const nvdaLp = VERIFIED_BEEFY_STOCK_DETAILS.NVDAc!.wantTokenAddress.toLowerCase();

  it("values LP balance × LP price and labels it as LP", async () => {
    liveRates.mockResolvedValue({ beefy: {}, aerodrome: {}, lpPrices: { NVDAc: 2e12 } });
    answerWith({ [`${nvdaLp}:balanceOf`]: ok(BigInt("50000000")) }); // 5e-11 LP

    const positions = await readAerodromeGaugePositions(user);
    expect(multicall).toHaveBeenCalledTimes(1);
    expect(positions).toHaveLength(1);
    const p = positions[0]!;
    expect(p.suppliedUsd).toBeCloseTo(5e-11 * 2e12, 6); // $100
    expect(p.suppliedFormatted).toBe("5.000e-11 LP");
    expect(p.assetAddress.toLowerCase()).toBe(nvdaLp);
  });

  it("returns null USD when the LP price is unavailable", async () => {
    liveRates.mockRejectedValue(new Error("beefy down"));
    answerWith({ [`${nvdaLp}:balanceOf`]: ok(E18) });

    const positions = await readAerodromeGaugePositions(user);
    expect(positions[0]?.suppliedUsd).toBeNull();
  });
});
