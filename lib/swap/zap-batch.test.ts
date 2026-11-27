import { describe, expect, it } from "vitest";
import { decodeFunctionData, encodeFunctionData, erc20Abi, type Address } from "viem";
import { buildContractCall, buildNativeTransferCall, hasBuilderSuffix } from "@/lib/utils/tx";
import { BEEFY_TOKEN_MANAGER, BEEFY_ZAP_ROUTER, ZAP_ROUTER_ABI } from "@/lib/lending/zap/zap-router";
import { buildSwapZapOrder, wrapSwapBatchForBrowserWallet } from "./zap-batch";

const USER = "0x00000000000000000000000000000000000000e1" as Address;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const ROUTER = "0x00000000000000000000000000000000000000a5" as Address;
const TREASURY = "0x00000000000000000000000000000000000000f3" as Address;
const SWAP_DATA = "0x414bf38900000000000000000000000000000000000000000000000000000000000000aa" as const;
const approve = (token: Address, spender: Address, amount: bigint) =>
  buildContractCall(token, encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] }));
const transfer = (token: Address, to: Address, amount: bigint) =>
  buildContractCall(token, encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, amount] }));

const client = (allowance: bigint, paused = false) =>
  ({
    readContract: async ({ functionName }: { functionName: string }) => {
      if (functionName === "paused") return paused;
      if (functionName === "allowance") return allowance;
      throw new Error(functionName);
    },
  }) as never;

describe("buildSwapZapOrder", () => {
  it("turns approve + swap + fee transfer into one route with the summed input", () => {
    const built = buildSwapZapOrder(USER, [approve(USDC, ROUTER, BigInt(995)), buildContractCall(ROUTER, SWAP_DATA), transfer(USDC, TREASURY, BigInt(5))]);
    expect(built).not.toBeNull();
    expect(built!.inputs).toEqual([{ token: USDC, amount: BigInt(1000) }]);
    expect(built!.route).toHaveLength(2);
    // The router (not the user) approves the swap router for its own balance.
    expect(built!.route[0]).toMatchObject({ target: ROUTER, tokens: [{ token: USDC, index: -1 }] });
    expect(built!.route[1].target).toBe(USDC);
    // Route steps carry no builder suffix; the user's own call does.
    expect(built!.route.every((s) => !hasBuilderSuffix(s.data))).toBe(true);
  });

  it("takes a shared approval once when several swaps use the same router (a basket)", () => {
    const built = buildSwapZapOrder(USER, [approve(USDC, ROUTER, BigInt(995)), buildContractCall(ROUTER, SWAP_DATA), buildContractCall(ROUTER, SWAP_DATA), transfer(USDC, TREASURY, BigInt(5))]);
    expect(built!.inputs).toEqual([{ token: USDC, amount: BigInt(1000) }]);
    expect(built!.route).toHaveLength(3);
  });

  it("supports native ETH swaps with a native fee", () => {
    const built = buildSwapZapOrder(USER, [buildContractCall(ROUTER, SWAP_DATA, BigInt(990)), buildNativeTransferCall(TREASURY, BigInt(10))]);
    expect(built!.inputs).toEqual([{ token: "0x0000000000000000000000000000000000000000", amount: BigInt(1000) }]);
  });

  it("refuses batches it doesn't understand", () => {
    // A call to a contract the batch never approved (and no ETH): not a swap we can vouch for.
    expect(buildSwapZapOrder(USER, [transfer(USDC, TREASURY, BigInt(1)), buildContractCall(ROUTER, SWAP_DATA)])).toBeNull();
    // Single call: nothing to save.
    expect(buildSwapZapOrder(USER, [buildContractCall(ROUTER, SWAP_DATA, BigInt(1))])).toBeNull();
  });
});

describe("wrapSwapBatchForBrowserWallet", () => {
  const batch = [approve(USDC, ROUTER, BigInt(995)), buildContractCall(ROUTER, SWAP_DATA), transfer(USDC, TREASURY, BigInt(5))];

  it("asks for one exact approval to the TokenManager, then one order", async () => {
    const w = await wrapSwapBatchForBrowserWallet(client(BigInt(0)), USER, batch);
    expect(w!.calls).toHaveLength(2);
    const a = decodeFunctionData({ abi: erc20Abi, data: w!.calls[0].data });
    expect(a.functionName).toBe("approve");
    expect(a.args).toEqual([BEEFY_TOKEN_MANAGER, BigInt(1000)]);
    expect(w!.calls[1].to).toBe(BEEFY_ZAP_ROUTER);
    const o = decodeFunctionData({ abi: ZAP_ROUTER_ABI, data: w!.calls[1].data });
    const order = (o.args as unknown as [{ user: Address; recipient: Address; inputs: unknown[] }])[0];
    expect(order.user).toBe(USER);
    expect(order.recipient).toBe(USER);
    expect(w!.calls.every((c) => hasBuilderSuffix(c.data))).toBe(true);
  });

  it("skips the approval when the allowance already covers it", async () => {
    const w = await wrapSwapBatchForBrowserWallet(client(BigInt(1000)), USER, batch);
    expect(w!.calls).toHaveLength(1);
  });

  it("falls back (null) when the router is paused", async () => {
    expect(await wrapSwapBatchForBrowserWallet(client(BigInt(0), true), USER, batch)).toBeNull();
  });
});
