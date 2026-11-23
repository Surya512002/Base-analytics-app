import { describe, expect, it } from "vitest";
import { encodeFunctionData, erc20Abi } from "viem";
import { assertBuilderAttribution, buildB20Call, buildContractCall, buildExternalSwapCall, finalizeAppTransactionBatch, hasBuilderSuffix } from "@/lib/utils/tx";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";

const TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const OTHER_ROUTER = "0x00000000000000000000000000000000c0ffee00" as const;
const transfer = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: ["0x00000000000000000000000000000000000a11ce", BigInt(1)] });

describe("builder code is on every batch the app sends", () => {
  it("a normal call is stamped", () => {
    const batch = finalizeAppTransactionBatch([{ to: TOKEN, data: transfer }]);
    expect(batch.every((c) => hasBuilderSuffix(c.data))).toBe(true);
    expect(() => assertBuilderAttribution(batch)).not.toThrow();
  });

  it("a batch that must be sent byte-for-byte (unknown aggregator) gets an attribution call added", () => {
    const batch = finalizeAppTransactionBatch([buildExternalSwapCall(OTHER_ROUTER, "0x12345678")]);
    expect(batch.length).toBe(2);
    expect(() => assertBuilderAttribution(batch)).not.toThrow();
  });

  it("a B20-only batch (calldata can't carry the suffix) gets the companion", () => {
    const batch = finalizeAppTransactionBatch([buildB20Call(B20_FACTORY_ADDRESS, "0x12345678")]);
    expect(() => assertBuilderAttribution(batch)).not.toThrow();
  });

  it("a stamped call stays stamped once", () => {
    const stamped = buildContractCall(TOKEN, transfer);
    expect(finalizeAppTransactionBatch([stamped])[0].data).toBe(stamped.data);
  });

  it("the guard refuses a batch with no builder code at all", () => {
    expect(() => assertBuilderAttribution([{ data: transfer }])).toThrow(/builder code/);
    expect(() => assertBuilderAttribution([])).not.toThrow(); // an empty batch is rejected elsewhere
  });
});
