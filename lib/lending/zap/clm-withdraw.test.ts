import { describe, expect, it } from "vitest";
import { decodeFunctionData, type Address } from "viem";
import { CLM_ABI, BEEFY_VAULT_ABI, planClmWithdraw, type ClmVault, type ZapClient } from "./clm-zap";

const VAULT = "0x00000000000000000000000000000000000000a1" as Address;
const CLM = "0x00000000000000000000000000000000000000c1" as Address;
const USER = "0x00000000000000000000000000000000000000e1" as Address;

const info: ClmVault = {
  vault: VAULT,
  clm: CLM,
  strategy: "0x00000000000000000000000000000000000000d1",
  pool: "0x00000000000000000000000000000000000000f1",
  tickSpacing: 10,
  token0: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
  token1: { address: "0x0000000000000000000000000000000000000b20", symbol: "NVDAc", decimals: 8 },
  token0ValueShare: 0.5,
  priceToken1InToken0: 180,
};

/** previewWithdraw returns half the shares as token0 units and a tenth as token1 units. */
const client = {
  readContract: async ({ functionName, args }: { functionName: string; args?: readonly bigint[] }) => {
    if (functionName === "getPricePerFullShare") return BigInt(2) * BigInt(10) ** BigInt(18); // 1 vault share = 2 CLM shares
    if (functionName === "previewWithdraw") return [args![0] / BigInt(2), args![0] / BigInt(10)];
    throw new Error(`unexpected read ${functionName}`);
  },
} as unknown as ZapClient;

const decodeClmWithdraw = (data: `0x${string}`) => decodeFunctionData({ abi: CLM_ABI, data });

describe("planClmWithdraw", () => {
  it("withdraws CoW (CLM) shares held directly, without a vault unstake", async () => {
    const plan = await planClmWithdraw({ client, info, user: USER, clmShares: BigInt(1000), toToken0: false });
    expect(plan.steps.map((s) => s.kind)).toEqual(["withdraw"]);
    expect(plan.calls).toHaveLength(1);
    expect(plan.calls[0].to.toLowerCase()).toBe(CLM.toLowerCase());
    const d = decodeClmWithdraw(plan.calls[0].data);
    expect(d.functionName).toBe("withdraw");
    expect(d.args?.[0]).toBe(BigInt(1000));
    expect(plan.expected.clmShares).toBe(BigInt(1000));
  });

  it("unstakes vault shares first, converting them at the vault's price per share", async () => {
    const plan = await planClmWithdraw({ client, info, user: USER, vaultShares: BigInt(500), toToken0: false });
    expect(plan.steps.map((s) => s.kind)).toEqual(["unstake", "withdraw"]);
    expect(plan.calls[0].to.toLowerCase()).toBe(VAULT.toLowerCase());
    expect(decodeFunctionData({ abi: BEEFY_VAULT_ABI, data: plan.calls[0].data }).functionName).toBe("withdraw");
    expect(decodeClmWithdraw(plan.calls[1].data).args?.[0]).toBe(BigInt(1000));
  });

  it("refuses an empty withdrawal", async () => {
    await expect(planClmWithdraw({ client, info, user: USER, clmShares: BigInt(0) })).rejects.toThrow(/Nothing to withdraw/);
  });
});
