import { describe, expect, it } from "vitest";
import { appOgImage, sectionShare } from "@/lib/constants/app-url";
import { isOgSection } from "./sections";
import { OG_VERSION } from "./brand-kit";

describe("sharing images", () => {
  it("gives each section its own versioned address", () => {
    expect(appOgImage()).toContain(`/opengraph-image?ogv=${OG_VERSION}`);
    expect(appOgImage("earn")).toContain(`/api/og?v=earn&ogv=${OG_VERSION}`);
    expect(sectionShare("pay").twitter.images).toEqual([appOgImage("pay")]);
  });

  it("accepts only real section names", () => {
    expect(isOgSection("trade")).toBe(true);
    for (const bad of [null, "", "toString", "__proto__", "token"]) expect(isOgSection(bad)).toBe(false);
  });
});
