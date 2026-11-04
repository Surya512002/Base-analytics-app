import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "@/lib/i18n/types";
import { TRANSLATIONS, getTranslation } from "@/lib/i18n/translations";

describe("i18n Multi-Language System", () => {
  it("verifies all 6 required languages are registered", () => {
    const codes = SUPPORTED_LOCALES.map((l) => l.code);
    expect(codes).toContain("en");
    expect(codes).toContain("hi");
    expect(codes).toContain("ta");
    expect(codes).toContain("es");
    expect(codes).toContain("pt");
    expect(codes).toContain("id");
    expect(codes.length).toBe(6);
  });

  it("verifies translation dictionary contains all required navigation and action keys for each language", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const dict = getTranslation(locale.code);
      expect(dict).toBeDefined();

      // Navigation keys
      expect(dict.nav.explore).toBeTruthy();
      expect(dict.nav.swap).toBeTruthy();
      expect(dict.nav.lend).toBeTruthy();
      expect(dict.nav.vouchers).toBeTruthy();
      expect(dict.nav.launch).toBeTruthy();
      expect(dict.nav.profile).toBeTruthy();

      // Action keys
      expect(dict.actions.connectWallet).toBeTruthy();
      expect(dict.actions.supply).toBeTruthy();
      expect(dict.actions.exploreVault).toBeTruthy();
      expect(dict.actions.executeSwap).toBeTruthy();

      // Status keys
      expect(dict.status.loading).toBeTruthy();
      expect(dict.status.unavailable).toBeTruthy();
      expect(dict.status.confirmed).toBeTruthy();
    }
  });

  it("falls back to English when an invalid locale is requested", () => {
    const fallback = getTranslation("fr" as unknown as import("@/lib/i18n/types").SupportedLocale);
    expect(fallback).toEqual(TRANSLATIONS.en);
  });
});
