import { describe, expect, it } from "vitest";
import {
  screenWalletAddress,
  MockSanctionsProvider,
  KNOWN_TEST_SANCTIONED_ADDRESSES,
  ChainalysisOracleProvider,
  TrmLabsProvider,
  EllipticProvider,
  getSanctionsProvider,
} from "@/lib/compliance/sanctions";

describe("Pluggable Sanctions Screening Suite", () => {
  it("defaults to disabled without performing blocking checks", async () => {
    // When flag is disabled (default)
    const result = await screenWalletAddress("0x0000000000000000000000000000000000000bad");
    expect(result.isSanctioned).toBe(false);
    expect(result.provider).toBe("disabled");
  });

  it("handles null, undefined, or invalid addresses safely", async () => {
    const nullRes = await screenWalletAddress(null);
    expect(nullRes.isSanctioned).toBe(false);

    const emptyRes = await screenWalletAddress("");
    expect(emptyRes.isSanctioned).toBe(false);

    const non0xRes = await screenWalletAddress("invalid-addr");
    expect(non0xRes.isSanctioned).toBe(false);
  });

  it("identifies test sanctioned addresses via MockSanctionsProvider", async () => {
    const provider = new MockSanctionsProvider();

    for (const badAddr of KNOWN_TEST_SANCTIONED_ADDRESSES) {
      const res = await provider.screenAddress(badAddr as `0x${string}`);
      expect(res.isSanctioned).toBe(true);
      expect(res.provider).toBe("mock");
      expect(res.reason).toContain("mock sanctions database");
    }

    const cleanRes = await provider.screenAddress(
      "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as `0x${string}` // vitalik.eth
    );
    expect(cleanRes.isSanctioned).toBe(false);
    expect(cleanRes.provider).toBe("mock");
  });

  it("instantiates Chainalysis provider and fails safe without hardcoded unverified address", async () => {
    // Without contract address configured
    const unconfigured = new ChainalysisOracleProvider(undefined);
    const res = await unconfigured.screenAddress(
      "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as `0x${string}`
    );
    expect(res.isSanctioned).toBe(false);
    expect(res.provider).toBe("chainalysis_oracle");
    expect(res.reason).toContain("CHAINALYSIS_SANCTIONS_ORACLE_BASE");
  });

  it("instantiates TRM Labs provider and fails safe when API key is missing", async () => {
    const trm = new TrmLabsProvider();
    const res = await trm.screenAddress(
      "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as `0x${string}`
    );
    expect(res.isSanctioned).toBe(false);
    expect(res.provider).toBe("trm_labs");
    expect(res.reason).toContain("TRM_API_KEY");
  });

  it("instantiates Elliptic provider and fails safe when API key is missing", async () => {
    const elliptic = new EllipticProvider();
    const res = await elliptic.screenAddress(
      "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as `0x${string}`
    );
    expect(res.isSanctioned).toBe(false);
    expect(res.provider).toBe("elliptic");
    expect(res.reason).toContain("ELLIPTIC_API_KEY");
  });

  it("routes provider selection correctly via getSanctionsProvider", () => {
    expect(getSanctionsProvider("mock").id).toBe("mock");
    expect(getSanctionsProvider("chainalysis_oracle").id).toBe("chainalysis_oracle");
    expect(getSanctionsProvider("trm_labs").id).toBe("trm_labs");
    expect(getSanctionsProvider("elliptic").id).toBe("elliptic");
  });
});
