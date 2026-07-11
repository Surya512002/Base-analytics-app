import { describe, expect, it } from "vitest";
import { parseUnits } from "viem";
import {
  encodeCreateB20Calldata,
  mergeMintAllocations,
  predictB20Address,
  computeLaunchSalt,
} from "@/lib/b20/encode";
import { isB20AssetActivated } from "@/lib/b20/activation";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";
import { preflightB20Launch, B20_CREATE_GAS_LIMIT } from "@/lib/b20/preflight";
import { buildB20Call } from "@/lib/utils/tx";
import { isB20PrecompileAddress } from "@/lib/utils/tx";

const CREATOR = "0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F" as const;

describe("B20 launch encoding", () => {
  it("merges duplicate mint recipients", () => {
    const merged = mergeMintAllocations([
      { to: CREATOR, amount: parseUnits("100", 18) },
      { to: CREATOR, amount: parseUnits("50", 18) },
      { to: "0x0000000000000000000000000000000000000001", amount: parseUnits("10", 18) },
    ]);
    expect(merged).toHaveLength(2);
    const creatorMint = merged.find((m) => m.to.toLowerCase() === CREATOR.toLowerCase());
    expect(creatorMint?.amount).toBe(parseUnits("150", 18));
  });

  it("builds createB20 calldata with init calls", () => {
    const salt = computeLaunchSalt("TestCoin", "TEST", CREATOR, "1");
    const data = encodeCreateB20Calldata({
      name: "TestCoin",
      symbol: "TEST",
      creator: CREATOR,
      decimals: 18,
      supplyCap: parseUnits("1000000000", 18),
      salt,
      adminless: true,
      mints: [{ to: CREATOR, amount: parseUnits("1000000", 18) }],
    });
    expect(data.startsWith("0x")).toBe(true);
    expect(data.length).toBeGreaterThan(10);
  });

  it("buildB20Call sets factory gas and no builder suffix on data", () => {
    const salt = computeLaunchSalt("GasTest", "GAS", CREATOR, "2");
    const data = encodeCreateB20Calldata({
      name: "GasTest",
      symbol: "GAS",
      creator: CREATOR,
      decimals: 18,
      supplyCap: parseUnits("1000000000", 18),
      salt,
      adminless: true,
    });
    const call = buildB20Call(B20_FACTORY_ADDRESS, data);
    expect(isB20PrecompileAddress(call.to)).toBe(true);
    expect(call.gas).toBe(B20_CREATE_GAS_LIMIT);
    expect(call.data).toBe(data);
  });
});

describe("B20 on-chain preflight", () => {
  it("B20 asset is activated on Base mainnet", async () => {
    const activated = await isB20AssetActivated();
    expect(activated).toBe(true);
  }, 30_000);

  it("predictB20Address returns a 0xB20 address", async () => {
    const salt = computeLaunchSalt("Smoke", "SMK", CREATOR, String(Date.now()));
    const addr = await predictB20Address(CREATOR, salt);
    expect(addr).toMatch(/^0xB20/i);
  }, 30_000);

  it("preflight returns balance info for treasury wallet", async () => {
    const pre = await preflightB20Launch(CREATOR);
    expect(pre.activated).toBe(true);
    expect(Number(pre.balanceEth)).toBeGreaterThanOrEqual(0);
    expect(pre.minEth).toBeTruthy();
  }, 30_000);
});
