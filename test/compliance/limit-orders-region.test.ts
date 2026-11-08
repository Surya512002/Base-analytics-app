import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/limit-orders/region-check/route";
import { DEFAULT_RESTRICTED_REGIONS } from "@/src/config/compliance";

describe("Limit Orders Region Compliance Guard", () => {
  it("blocks US requests by default", async () => {
    const req = new NextRequest("http://localhost:3000/api/limit-orders/region-check", {
      headers: { "x-user-country": "US" },
    });
    const res = await GET(req);
    const data = await res.json();
    expect(data.restricted).toBe(true);
    expect(data.country).toBe("US");
  });

  it("blocks all countries defined in app DEFAULT_RESTRICTED_REGIONS", async () => {
    for (const country of DEFAULT_RESTRICTED_REGIONS) {
      const req = new NextRequest("http://localhost:3000/api/limit-orders/region-check", {
        headers: { "x-user-country": country },
      });
      const res = await GET(req);
      const data = await res.json();
      expect(data.restricted).toBe(true);
      expect(data.country).toBe(country);
    }
  });

  it("allows non-restricted European and Asian jurisdictions", async () => {
    const allowed = ["DE", "GB", "FR", "JP", "SG", "CH"];
    for (const country of allowed) {
      const req = new NextRequest("http://localhost:3000/api/limit-orders/region-check", {
        headers: { "x-user-country": country },
      });
      const res = await GET(req);
      const data = await res.json();
      expect(data.restricted).toBe(false);
      expect(data.country).toBe(country);
    }
  });

  it("respects additional countries configured in LIMIT_ORDERS_BLOCKED_COUNTRIES", async () => {
    process.env.LIMIT_ORDERS_BLOCKED_COUNTRIES = "CA,AU";
    try {
      const reqCA = new NextRequest("http://localhost:3000/api/limit-orders/region-check", {
        headers: { "x-user-country": "CA" },
      });
      const resCA = await GET(reqCA);
      const dataCA = await resCA.json();
      expect(dataCA.restricted).toBe(true);

      const reqAU = new NextRequest("http://localhost:3000/api/limit-orders/region-check", {
        headers: { "x-user-country": "AU" },
      });
      const resAU = await GET(reqAU);
      const dataAU = await resAU.json();
      expect(dataAU.restricted).toBe(true);
    } finally {
      delete process.env.LIMIT_ORDERS_BLOCKED_COUNTRIES;
    }
  });
});
