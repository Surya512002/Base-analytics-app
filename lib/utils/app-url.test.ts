import { describe, expect, it } from "vitest";
import { resolveTabFromUrl } from "@/lib/utils/app-url";

describe("resolveTabFromUrl", () => {
  it("maps explore, swap, lend, and voucher aliases", () => {
    expect(resolveTabFromUrl("?tab=explore")).toBe("launchpad");
    expect(resolveTabFromUrl("?tab=voucher")).toBe("basehub");
    expect(resolveTabFromUrl("?tab=analytics")).toBe("launchpad");
    expect(resolveTabFromUrl("?tab=quests")).toBe("launchpad");
    expect(resolveTabFromUrl("?tab=actions")).toBe("launchpad");
    expect(resolveTabFromUrl("?tab=habits")).toBe("launchpad");
    expect(resolveTabFromUrl("?tab=streaks")).toBe("launchpad");
    expect(resolveTabFromUrl("?tab=swap")).toBe("swap");
    expect(resolveTabFromUrl("?tab=lend")).toBe("lend");
  });

  it("infers basehub tab when claim link parameters are present without tab param", () => {
    expect(resolveTabFromUrl("?card=41-0")).toBe("basehub");
    expect(resolveTabFromUrl("?cardId=41-0")).toBe("basehub");
    expect(resolveTabFromUrl("?voucher=41-0")).toBe("basehub");
    expect(resolveTabFromUrl("?c=41-0")).toBe("basehub");
  });

  it("returns null for unknown tabs", () => {
    expect(resolveTabFromUrl("?tab=unknown")).toBeNull();
  });
});
