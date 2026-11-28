import { describe, expect, it } from "vitest";
import { decodeIndex, encodeIndex } from "./index-link";

const shared = { weights: { NVDAc: 25, GOOGLc: 22.5, AAPLc: 20 }, rules: { maxPct: 25, cashPct: 10 } };
const read = (query: string) => decodeIndex(new URLSearchParams(query));

describe("index links", () => {
  it("round-trips an index", () => {
    expect(read(encodeIndex(shared))).toEqual(shared);
  });

  it("keeps the order the owner chose", () => {
    expect(Object.keys(read(encodeIndex(shared))!.weights)).toEqual(["NVDAc", "GOOGLc", "AAPLc"]);
  });

  it("refuses anything that isn't an official stock with a sensible weight", () => {
    const bad = [
      "mix=NVDAc-25,SCAMc-20&max=25&cash=10", // not on the official list
      "mix=NVDAc-25,<script>-20&max=25&cash=10",
      "mix=NVDAc-25,NVDAc-20&max=25&cash=10", // twice
      "mix=NVDAc-80,AAPLc-30&max=100&cash=0", // over 100%
      "mix=NVDAc-0.5,AAPLc-30&max=25&cash=10",
      "mix=NVDAc-1e2,AAPLc-30&max=25&cash=10",
      "mix=NVDAc-25-9,AAPLc-30&max=25&cash=10",
      "mix=NVDAc-25&max=25&cash=10", // one stock
      "mix=NVDAc-25,AAPLc-20&max=500&cash=10",
      "mix=NVDAc-25,AAPLc-20&max=25",
      "",
    ];
    for (const query of bad) expect(read(query), query).toBeNull();
  });
});
