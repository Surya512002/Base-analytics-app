import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ENTRIES, PLACE_HREF, placeFor, searchEntries } from "./directory";

const ids = (q: string) => searchEntries(q).map((e) => e.id);

describe("directory", () => {
  it("only links to pages that exist", () => {
    for (const href of [...ENTRIES.map((e) => e.href), ...Object.values(PLACE_HREF)]) {
      const path = href.split("?")[0];
      expect(existsSync(`app${path === "/" ? "" : path}/page.tsx`), href).toBe(true);
    }
  });

  it("finds things by everyday words", () => {
    expect(ids("limit order")).toContain("orders");
    expect(ids("gift")).toEqual(expect.arrayContaining(["send-gift", "receive-gift"]));
    expect(ids("borrow")).toContain("lend");
    expect(ids("recurring")).toContain("auto-invest");
    expect(ids("my stocks")).toContain("holdings");
    expect(ids("my orders")).toContain("my-orders");
    expect(ids("dark mode")).toEqual(["settings"]);
    expect(ids("zzzz")).toEqual([]);
  });

  it("highlights the right menu item", () => {
    expect(placeFor("/")).toBe("home");
    expect(placeFor("/", "basehub")).toBe("gifts");
    expect(placeFor("/explore")).toBe("markets");
    expect(placeFor("/explore/token/0xabc")).toBe("trade");
    expect(placeFor("/swap")).toBe("trade");
    expect(placeFor("/lend")).toBe("earn");
    expect(placeFor("/creator/0xabc")).toBe("account");
  });
});
