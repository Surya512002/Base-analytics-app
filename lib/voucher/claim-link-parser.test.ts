import { describe, it, expect, beforeEach } from "vitest";
import {
  parseClaimLink,
  isValidCardIdFormat,
  normalizeSecret,
  formatClaimLink,
} from "./claim-link-parser";

describe("Voucher Claim Link Compatibility", () => {
  describe("isValidCardIdFormat", () => {
    it("validates correct batchId-cardIndex formats", () => {
      expect(isValidCardIdFormat("41-0")).toBe(true);
      expect(isValidCardIdFormat("132-9")).toBe(true);
      expect(isValidCardIdFormat("0-0")).toBe(true);
      expect(isValidCardIdFormat(" 41-0 ")).toBe(true);
    });

    it("rejects malformed card IDs", () => {
      expect(isValidCardIdFormat("41")).toBe(false);
      expect(isValidCardIdFormat("41-")).toBe(false);
      expect(isValidCardIdFormat("-0")).toBe(false);
      expect(isValidCardIdFormat("41-abc")).toBe(false);
      expect(isValidCardIdFormat("abc-0")).toBe(false);
      expect(isValidCardIdFormat("")).toBe(false);
    });
  });

  describe("normalizeSecret", () => {
    it("trims and converts to uppercase", () => {
      expect(normalizeSecret("abc123xyz")).toBe("ABC123XYZ");
      expect(normalizeSecret("  sk_secret_99  ")).toBe("SK_SECRET_99");
    });
  });

  describe("parseClaimLink - Legacy and Modern Link Formats", () => {
    it("parses modern safe fragment link: /?tab=basehub&view=redeem#id=41-0&secret=XYZ", () => {
      const url = "https://base-analytics-app.vercel.app/?tab=basehub&view=redeem#id=41-0&secret=SEC777";
      const result = parseClaimLink(url);
      expect(result.cardId).toBe("41-0");
      expect(result.secret).toBe("SEC777");
      expect(result.hasVoucherIntent).toBe(true);
    });

    it("parses modern fragment link with key alias: /?tab=basehub#id=41-0&key=abc", () => {
      const url = "https://base-analytics-app.vercel.app/?tab=basehub#id=41-0&key=abc";
      const result = parseClaimLink(url);
      expect(result.cardId).toBe("41-0");
      expect(result.secret).toBe("ABC");
      expect(result.hasVoucherIntent).toBe(true);
    });

    it("parses fragment link with card alias: #card=41-0&secret=XYZ", () => {
      const url = "https://base-analytics-app.vercel.app/#card=41-0&secret=XYZ";
      const result = parseClaimLink(url);
      expect(result.cardId).toBe("41-0");
      expect(result.secret).toBe("XYZ");
      expect(result.hasVoucherIntent).toBe(true);
    });

    it("parses standard query link: /?tab=basehub&card=41-0&secret=XYZ", () => {
      const url = "https://base-analytics-app.vercel.app/?tab=basehub&card=41-0&secret=XYZ";
      const result = parseClaimLink(url);
      expect(result.cardId).toBe("41-0");
      expect(result.secret).toBe("XYZ");
      expect(result.hasVoucherIntent).toBe(true);
    });

    it("parses legacy tab query link: /?tab=voucher&card=41-0&secret=XYZ", () => {
      const url = "https://base-analytics-app.vercel.app/?tab=voucher&card=41-0&secret=XYZ";
      const result = parseClaimLink(url);
      expect(result.cardId).toBe("41-0");
      expect(result.secret).toBe("XYZ");
      expect(result.hasVoucherIntent).toBe(true);
    });

    it("parses legacy tab plural query: /?tab=vouchers&cardId=41-0&key=XYZ", () => {
      const url = "https://base-analytics-app.vercel.app/?tab=vouchers&cardId=41-0&key=XYZ";
      const result = parseClaimLink(url);
      expect(result.cardId).toBe("41-0");
      expect(result.secret).toBe("XYZ");
      expect(result.hasVoucherIntent).toBe(true);
    });

    it("parses short query aliases: /?c=41-0&s=XYZ", () => {
      const url = "https://base-analytics-app.vercel.app/?c=41-0&s=xyz";
      const result = parseClaimLink(url);
      expect(result.cardId).toBe("41-0");
      expect(result.secret).toBe("XYZ");
      expect(result.hasVoucherIntent).toBe(true);
    });

    it("parses query alias voucher: /?voucher=41-0", () => {
      const url = "https://base-analytics-app.vercel.app/?voucher=41-0";
      const result = parseClaimLink(url);
      expect(result.cardId).toBe("41-0");
      expect(result.secret).toBeNull();
      expect(result.hasVoucherIntent).toBe(true);
    });

    it("parses dedicated redeem landing page: /redeem?card=41-0", () => {
      const url = "https://base-analytics-app.vercel.app/redeem?card=41-0";
      const result = parseClaimLink(url);
      expect(result.cardId).toBe("41-0");
      expect(result.hasVoucherIntent).toBe(true);
    });

    it("parses dedicated redeem landing page with fragment: /redeem#id=41-0&secret=XYZ", () => {
      const url = "https://base-analytics-app.vercel.app/redeem#id=41-0&secret=XYZ";
      const result = parseClaimLink(url);
      expect(result.cardId).toBe("41-0");
      expect(result.secret).toBe("XYZ");
      expect(result.hasVoucherIntent).toBe(true);
    });

    it("parses relative URL strings", () => {
      const rel1 = "/?tab=basehub&card=41-0";
      expect(parseClaimLink(rel1).cardId).toBe("41-0");

      const rel2 = "/#id=41-0&secret=ABC";
      expect(parseClaimLink(rel2).cardId).toBe("41-0");
      expect(parseClaimLink(rel2).secret).toBe("ABC");
    });

    it("returns nulls for unrelated URLs", () => {
      const url = "https://base-analytics-app.vercel.app/?tab=swap";
      const result = parseClaimLink(url);
      expect(result.cardId).toBeNull();
      expect(result.secret).toBeNull();
      expect(result.hasVoucherIntent).toBe(false);
    });
  });

  describe("formatClaimLink", () => {
    it("generates privacy-safe fragment link by default", () => {
      const link = formatClaimLink("41-0", "SEC777", {
        baseUrl: "https://base-analytics-app.vercel.app",
      });
      expect(link).toBe(
        "https://base-analytics-app.vercel.app/?tab=basehub&view=redeem#id=41-0&secret=SEC777"
      );
    });

    it("generates query mode link if requested", () => {
      const link = formatClaimLink("41-0", "SEC777", {
        baseUrl: "https://base-analytics-app.vercel.app",
        mode: "query",
      });
      expect(link).toBe(
        "https://base-analytics-app.vercel.app/?tab=basehub&view=redeem&card=41-0&secret=SEC777"
      );
    });
  });
});
