import { describe, it, expect } from "vitest";
import { renderAppThumbnail } from "@/lib/marketing/render-thumbnail";
import { OG_VERSION } from "@/lib/og/brand-kit";

describe("renderAppThumbnail", () => {
  it("renders thumbnail tree with correct version and structure", () => {
    expect(OG_VERSION).toBe("21");
    const el = renderAppThumbnail();
    expect(el).toBeDefined();
    expect(el.props).toBeDefined();
    expect(el.props.style).toBeDefined();
    expect(el.props.style.width).toBe("100%");
    expect(el.props.style.height).toBe("100%");
  });

  it("handles custom trending tokens gracefully", () => {
    const el = renderAppThumbnail([
      { sym: "B20", chg: "+25.4%", vol: "$1.2M", type: "b20" },
      { sym: "TSLA", chg: "+3.2%", vol: "$5.1M", type: "stock" },
    ]);
    expect(el).toBeDefined();
    expect(el.props.children).toBeDefined();
  });
});
