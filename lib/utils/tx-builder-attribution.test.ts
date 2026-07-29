import { describe, expect, it } from "vitest";
import {
  buildB20Call,
  buildBuilderAttributionCall,
  finalizeAppTransactionBatch,
  hasBuilderSuffix,
  isB20PrecompileAddress,
} from "@/lib/utils/tx";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";

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
