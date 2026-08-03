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

  it("maps legacy stake aliases to checkin hub", () => {
    expect(resolveTabFromUrl("?tab=stake")).toBe("checkin");
    expect(resolveTabFromUrl("?tab=staking")).toBe("checkin");
    expect(resolveTabFromUrl("?tab=rewards")).toBe("checkin");
  });
});

describe("resolveRewardsViewFromUrl", () => {
  it("always resolves to checkin after stake removal", () => {
    expect(resolveRewardsViewFromUrl("?tab=checkin&view=stake")).toBe("checkin");
    expect(resolveRewardsViewFromUrl("?tab=stake")).toBe("checkin");
    expect(resolveRewardsViewFromUrl("?tab=checkin")).toBe("checkin");
  });
});
