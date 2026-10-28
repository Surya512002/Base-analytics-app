import { describe, expect, it } from "vitest";
import {
  complianceConfig,
  DEFAULT_RESTRICTED_REGIONS,
  evaluateRegionCompliance,
  fetchRemoteKillSwitch,
} from "@/src/config/compliance";

describe("Central Compliance Configuration Suite", () => {
  it("verifies typed feature flags exist and have boolean values", () => {
    expect(complianceConfig.features).toBeDefined();
    expect(typeof complianceConfig.features["stocks.swap"]).toBe("boolean");
    expect(typeof complianceConfig.features["stocks.lend"]).toBe("boolean");
    expect(typeof complianceConfig.features["stocks.launchPairs"]).toBe("boolean");
    expect(typeof complianceConfig.features["stocks.vouchers"]).toBe("boolean");
  });

  it("verifies DEFAULT_RESTRICTED_REGIONS contains US and standard sanctioned jurisdictions", () => {
    expect(DEFAULT_RESTRICTED_REGIONS).toContain("US");
    // Sanctioned jurisdictions (DRAFT TODO list for counsel)
    expect(DEFAULT_RESTRICTED_REGIONS).toContain("CU"); // Cuba
    expect(DEFAULT_RESTRICTED_REGIONS).toContain("IR"); // Iran
    expect(DEFAULT_RESTRICTED_REGIONS).toContain("KP"); // North Korea
    expect(DEFAULT_RESTRICTED_REGIONS).toContain("SY"); // Syria
    expect(DEFAULT_RESTRICTED_REGIONS).toContain("RU"); // Russia
  });

  it("evaluates unrestricted regions with full access", () => {
    const allowed = ["DE", "GB", "JP", "FR", "SG", "CH"];
    for (const country of allowed) {
      const result = evaluateRegionCompliance(country, "stocks.swap");
      expect(result.isRestricted).toBe(false);
      expect(result.mode).toBe("full");
      expect(result.canEnter).toBe(true);
      expect(result.canExit).toBe(true);
    }
  });

  it("evaluates restricted regions under exit-only mode (preserves exit/withdrawal rights)", () => {
    const restricted = ["US", "IR", "KP", "CU", "SY", "RU"];
    for (const country of restricted) {
      const result = evaluateRegionCompliance(country, "stocks.swap");
      expect(result.isRestricted).toBe(true);
      expect(result.mode).toBe("exit-only");
      expect(result.canEnter).toBe(false); // Entry/buy blocked
      expect(result.canExit).toBe(true);   // Exit/sell/withdraw ALWAYS allowed!
    }
  });

  it("handles case-insensitivity and whitespace in country codes", () => {
    const lowercaseUs = evaluateRegionCompliance("  us  ", "stocks.swap");
    expect(lowercaseUs.isRestricted).toBe(true);
    expect(lowercaseUs.canEnter).toBe(false);
    expect(lowercaseUs.canExit).toBe(true);

    const lowercaseDe = evaluateRegionCompliance(" de ", "stocks.swap");
    expect(lowercaseDe.isRestricted).toBe(false);
    expect(lowercaseDe.canEnter).toBe(true);
  });

  it("fails safe when country header is missing or null", () => {
    const nullCountry = evaluateRegionCompliance(null, "stocks.swap");
    expect(nullCountry.isRestricted).toBe(true);
    expect(nullCountry.canEnter).toBe(false);
    expect(nullCountry.canExit).toBe(true); // Exit-only preserves user funds access
  });

  it("evaluates blocked mode strictly when configured", () => {
    const blockedModeResult = evaluateRegionCompliance("US", "stocks.swap", {
      restrictedRegionMode: "blocked",
    });
    expect(blockedModeResult.isRestricted).toBe(true);
    expect(blockedModeResult.mode).toBe("blocked");
    expect(blockedModeResult.canEnter).toBe(false);
    expect(blockedModeResult.canExit).toBe(false);
  });

  it("supports per-feature restricted region overrides", () => {
    // Override where DE is restricted specifically for launchPairs but not swap
    const customConfig = {
      ...complianceConfig,
      featureRestrictedRegions: {
        ...complianceConfig.featureRestrictedRegions,
        "stocks.launchPairs": ["DE"],
      },
    };

    const swapInDe = evaluateRegionCompliance("DE", "stocks.swap", customConfig);
    expect(swapInDe.isRestricted).toBe(false);

    const launchInDe = evaluateRegionCompliance("DE", "stocks.launchPairs", customConfig);
    expect(launchInDe.isRestricted).toBe(true);
    expect(launchInDe.canEnter).toBe(false);
  });

  it("evaluates remote kill switch with safe fallback to local config", async () => {
    const killSwitch = await fetchRemoteKillSwitch();
    expect(typeof killSwitch).toBe("boolean");
    // Local config default is false
    expect(killSwitch).toBe(complianceConfig.globalKillSwitch);
  });
});
