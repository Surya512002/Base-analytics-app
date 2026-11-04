import { describe, it, expect } from "vitest";
import { parseIntent } from "@/lib/intent/intent-parser";

describe("parseIntent", () => {
  it("parses full swap pair intent: swap 50 USDC to ETH", () => {
    const res = parseIntent("swap 50 USDC to ETH");
    expect(res).not.toBeNull();
    expect(res?.type).toBe("swap");
    expect(res?.params?.amount).toBe("50");
    expect(res?.params?.sell).toContain("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(res?.params?.buy).toBe("ETH");
    expect(res?.href).toContain("/swap?sell=");
    expect(res?.href).toContain("amount=50");
  });

  it("parses single token swap: swap 100 eth", () => {
    const res = parseIntent("swap 100 eth");
    expect(res).not.toBeNull();
    expect(res?.type).toBe("swap");
    expect(res?.params?.amount).toBe("100");
    expect(res?.params?.sell).toBe("ETH");
  });

  it("parses buy token intent: buy 500 degen", () => {
    const res = parseIntent("buy 500 degen");
    expect(res).not.toBeNull();
    expect(res?.type).toBe("swap");
    expect(res?.params?.amount).toBe("500");
    expect(res?.params?.buy).toBe("0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed");
  });

  it("parses gift intent: gift 10 USDC", () => {
    const res = parseIntent("gift 10 USDC");
    expect(res).not.toBeNull();
    expect(res?.type).toBe("gift");
    expect(res?.params?.amount).toBe("10");
    expect(res?.params?.asset).toBe("USDC");
    expect(res?.href).toContain("tab=basehub");
    expect(res?.href).toContain("total=10");
  });

  it("parses launch token intent: launch token", () => {
    const res = parseIntent("launch token");
    expect(res).not.toBeNull();
    expect(res?.type).toBe("launch");
    expect(res?.href).toBe("/launch");
    expect(res?.tab).toBe("launchpad");
  });

  it("parses lend and stake intent", () => {
    const res = parseIntent("stake usdc");
    expect(res).not.toBeNull();
    expect(res?.type).toBe("lend");
    expect(res?.href).toBe("/lend");
  });

  it("parses profile streak intent", () => {
    const res = parseIntent("daily streak");
    expect(res).not.toBeNull();
    expect(res?.type).toBe("profile");
    expect(res?.href).toBe("/profile");
  });

  it("returns null for non-intent generic query", () => {
    const res = parseIntent("unknown token XYZ");
    expect(res).toBeNull();
  });
});
