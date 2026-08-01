import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readAnalyticsUnlocked,
  writeAnalyticsUnlocked,
  clearAnalyticsUnlocked,
} from "@/lib/utils/analytics-unlock";

const ADDR = "0xaBcDef1234567890123456789012345678901234";

function mockBrowserStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  });
}

describe("analytics-unlock storage", () => {
  beforeEach(() => {
    mockBrowserStorage();
  });

  it("starts locked for unknown wallet", () => {
    expect(readAnalyticsUnlocked(ADDR)).toBe(false);
  });

  it("persists unlock per address", () => {
    writeAnalyticsUnlocked(ADDR, "token-abc");
    expect(readAnalyticsUnlocked(ADDR)).toBe(true);
    expect(readAnalyticsUnlocked("0x0000000000000000000000000000000000000001")).toBe(false);
  });

  it("clears unlock on disconnect", () => {
    writeAnalyticsUnlocked(ADDR, "token-abc");
    clearAnalyticsUnlocked(ADDR);
    expect(readAnalyticsUnlocked(ADDR)).toBe(false);
  });
});
