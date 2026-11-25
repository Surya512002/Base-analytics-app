import { describe, expect, it } from "vitest";
import { routeOwnsTab } from "@/lib/utils/wallet-persist";

describe("routeOwnsTab", () => {
  it("leaves screens with their own address alone when a wallet connects", () => {
    for (const p of ["/swap", "/trade", "/lend", "/drops", "/drops/12", "/explore", "/explore/token/0xabc", "/launch"]) {
      expect(routeOwnsTab(p), p).toBe(true);
    }
  });

  it("still lets the home page pick the screen", () => {
    for (const p of ["/", "/redeem", "/swapping", "/lender"]) expect(routeOwnsTab(p), p).toBe(false);
  });
});
