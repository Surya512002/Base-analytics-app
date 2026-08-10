import { describe, expect, it } from "vitest";
import {
  buildB20Call,
  buildBuilderAttributionCall,
  buildContractCall,
  buildExternalSwapCall,
  buildNativeTransferCall,
  bundleCallsViaMulticall3,
  batchCanUseWalletDataSuffix,
  batchCarriesBuilderAttribution,
  finalizeAppTransactionBatch,
  getBuilderSuffix,
  hasBuilderSuffix,
  isB20PrecompileAddress,
  prepareCallsForWalletSendCalls,
} from "@/lib/utils/tx";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";
import { LAUNCHPAD_TREASURY } from "@/lib/constants/launchpad";

const ZERO_X = "0x0000000000001fF3684f28c67538d4D072C22734" as `0x${string}`;
const ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481" as `0x${string}`;
const QUOTE_DATA =
  "0x04e45aaf000000000000000000000000420000000000000000000000000000000000000600000000000000000000000083305f968cdb605fb3c122e65e41017bdc69ff71" as `0x${string}`;

describe("builder attribution on B20 launch batches", () => {
  it("B20 factory create alone gets a treasury companion with builder suffix", () => {
    const create = buildB20Call(
      B20_FACTORY_ADDRESS,
      "0x1234abcd" as `0x${string}`
    );
    expect(isB20PrecompileAddress(create.to)).toBe(true);
    expect(hasBuilderSuffix(create.data)).toBe(false);

    const batch = finalizeAppTransactionBatch([create]);
    expect(batch).toHaveLength(2);
    expect(batch[0]).toEqual(create);
    expect(isB20PrecompileAddress(batch[1]!.to)).toBe(false);
    expect(hasBuilderSuffix(batch[1]!.data)).toBe(true);
    expect(batchCarriesBuilderAttribution(batch)).toBe(true);
  });

  it("skipCompanion leaves B20 create without attribution", () => {
    const create = buildB20Call(
      B20_FACTORY_ADDRESS,
      "0x1234abcd" as `0x${string}`
    );
    const batch = finalizeAppTransactionBatch([create], { skipCompanion: true });
    expect(batch).toHaveLength(1);
    expect(hasBuilderSuffix(batch[0]!.data)).toBe(false);
  });

  it("explicit companion call already carries builder suffix", () => {
    const companion = buildBuilderAttributionCall();
    expect(hasBuilderSuffix(companion.data)).toBe(true);
  });
});

describe("builder attribution on pure 0x / preserved batches", () => {
  it("0x-only swap batch gets a treasury companion", () => {
    const swap = buildExternalSwapCall(ZERO_X, QUOTE_DATA, BigInt(1e15));
    expect(hasBuilderSuffix(swap.data)).toBe(false);

    const batch = finalizeAppTransactionBatch([swap]);
    expect(batch).toHaveLength(2);
    expect(batch[0]).toEqual(swap);
    expect(hasBuilderSuffix(batch[1]!.data)).toBe(true);
    expect(batchCarriesBuilderAttribution(batch)).toBe(true);
  });

  it("fee + 0x keeps builder on the fee leg after wallet prepare", () => {
    const fee = buildNativeTransferCall(
      LAUNCHPAD_TREASURY as `0x${string}`,
      BigInt(1e12)
    );
    const swap = buildExternalSwapCall(ZERO_X, QUOTE_DATA, BigInt(1e15));
    const batch = finalizeAppTransactionBatch([fee, swap]);
    expect(batch).toHaveLength(2);
    expect(hasBuilderSuffix(batch[0]!.data)).toBe(true);
    expect(batchCanUseWalletDataSuffix(batch)).toBe(false);

    const prepared = prepareCallsForWalletSendCalls(batch);
    // Must NOT strip fee — wallet cannot safely dataSuffix over preserved 0x.
    expect(hasBuilderSuffix(prepared[0]!.data)).toBe(true);
    expect(prepared[1]!.data).toBe(swap.data);
  });
});

describe("builder attribution on Multicall3 swap packs", () => {
  it("keeps builder code in Multical payload without suffixing the outer aggregate", () => {
    const fee = buildNativeTransferCall(
      LAUNCHPAD_TREASURY as `0x${string}`,
      BigInt(1e12)
    );
    const swap = buildContractCall(ROUTER, QUOTE_DATA, BigInt(1e15));
    expect(hasBuilderSuffix(swap.data)).toBe(true);

    const packed = bundleCallsViaMulticall3([fee, swap]);
    expect(packed.to.toLowerCase()).toBe(
      "0xca11bde05977b3631167028862be2a173976ca11"
    );
    expect(packed.preserveCalldata).toBe(true);
    // Outer Multical ABI must stay valid — no builder suffix on the envelope.
    expect(hasBuilderSuffix(packed.data)).toBe(false);
    // Full Multical input (inner callData) still includes builder bytes for indexing.
    expect(packed.data.toLowerCase()).toContain(getBuilderSuffix().toLowerCase());
    expect(batchCarriesBuilderAttribution([packed])).toBe(true);
  });

  it("0x-only Multical pack injects an attribution inner leg", () => {
    const swap = buildExternalSwapCall(ZERO_X, QUOTE_DATA, BigInt(1e15));
    const fee = buildNativeTransferCall(
      LAUNCHPAD_TREASURY as `0x${string}`,
      BigInt(1e12)
    );
    // fee carries builder; Multical should still index it
    const packed = bundleCallsViaMulticall3([fee, swap]);
    expect(packed.data.toLowerCase()).toContain(getBuilderSuffix().toLowerCase());
  });
});

describe("wallet_sendCalls prepare policy", () => {
  it("strips suffix only for fully rewritable batches", () => {
    const approve = buildContractCall(
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as `0x${string}`,
      "0x095ea7b3000000000000000000000000ffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`
    );
    expect(hasBuilderSuffix(approve.data)).toBe(true);
    expect(batchCanUseWalletDataSuffix([approve])).toBe(true);

    const prepared = prepareCallsForWalletSendCalls([approve]);
    expect(hasBuilderSuffix(prepared[0]!.data)).toBe(false);
  });
});
