import { describe, expect, it } from "vitest";
import { resolveTabFromUrl, resolveRewardsViewFromUrl } from "@/lib/utils/app-url";

describe("resolveTabFromUrl", () => {
  it("maps explore and voucher aliases", () => {
    expect(resolveTabFromUrl("?tab=explore")).toBe("launchpad");
    expect(resolveTabFromUrl("?tab=voucher")).toBe("basehub");
    expect(resolveTabFromUrl("?tab=analytics")).toBe("dashboard");
    expect(resolveTabFromUrl("?tab=quests")).toBe("checkin");
  });

  it("returns null for unknown tabs", () => {
    expect(resolveTabFromUrl("?tab=unknown")).toBeNull();
  });
});

describe("resolveRewardsViewFromUrl", () => {
  it("resolves stake view", () => {
    expect(resolveRewardsViewFromUrl("?tab=checkin&view=stake")).toBe("stake");
    expect(resolveRewardsViewFromUrl("?tab=stake")).toBe("stake");
    expect(resolveRewardsViewFromUrl("?tab=checkin")).toBe("checkin");
  });
});
