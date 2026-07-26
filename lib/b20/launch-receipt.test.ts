import { describe, expect, it } from "vitest";
import {
  B20_TOKEN_PLACEHOLDER,
  extractB20TokenFromReceipt,
  isInvalidLaunchTokenAddress,
} from "@/lib/b20/launch-receipt";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";

describe("launch receipt helpers", () => {
  it("flags factory and placeholder as invalid token addresses", () => {
    expect(isInvalidLaunchTokenAddress(B20_FACTORY_ADDRESS)).toBe(true);
    expect(isInvalidLaunchTokenAddress(B20_TOKEN_PLACEHOLDER)).toBe(true);
    expect(
      isInvalidLaunchTokenAddress("0xb2000000000000000000007E07Dc0291e7897473")
    ).toBe(false);
  });
});
