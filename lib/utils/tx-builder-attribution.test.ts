import { describe, expect, it } from "vitest";
import {
  buildB20Call,
  buildBuilderAttributionCall,
  buildContractCall,
  buildNativeTransferCall,
  bundleCallsViaMulticall3,
  finalizeAppTransactionBatch,
  getBuilderSuffix,
  hasBuilderSuffix,
  isB20PrecompileAddress,
} from "@/lib/utils/tx";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";
import { LAUNCHPAD_TREASURY } from "@/lib/constants/launchpad";

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

describe("builder attribution on Multicall3 swap packs", () => {
  it("keeps builder code in Multical payload without suffixing the outer aggregate", () => {
    const fee = buildNativeTransferCall(LAUNCHPAD_TREASURY as `0x${string}`, BigInt(1e12));
    const swap = buildContractCall(
      "0x2626664c2603336E57B271c5C0b26F421741e481" as `0x${string}`,
      "0x04e45aaf000000000000000000000000420000000000000000000000000000000000000600000000000000000000000083305f968cdb605fb3c122e65e41017bdc69ff71" as `0x${string}`,
      BigInt(1e15)
    );
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
  });
});
