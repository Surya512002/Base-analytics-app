import { describe, expect, it, beforeEach } from "vitest";
import {
  ANALYSIS_FRESH_MS,
  clearAnalysisFreshness,
  isAnalysisFresh,
  isHistorySyncFresh,
  markAnalysisFresh,
  shouldSkipBackgroundRescan,
} from "@/lib/utils/analysis-freshness";

const ADDR = "0x1111111111111111111111111111111111111111";

function installMemoryStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
  });
}

describe("analysis-freshness", () => {
  beforeEach(() => {
    installMemoryStorage();
    clearAnalysisFreshness(ADDR);
  });

  it("is stale until marked", () => {
    expect(isAnalysisFresh(ADDR)).toBe(false);
    expect(shouldSkipBackgroundRescan(ADDR)).toBe(false);
  });

  it("skips background rescan when score is fresh", () => {
    markAnalysisFresh(ADDR, {
      historyComplete: true,
      score: 40,
      uniqueDays: 20,
      txCount: 500,
    });
    expect(isAnalysisFresh(ADDR)).toBe(true);
    expect(isHistorySyncFresh(ADDR)).toBe(true);
    expect(shouldSkipBackgroundRescan(ADDR)).toBe(true);
  });

  it("still skips re-sync while score is warm even if incomplete", () => {
    markAnalysisFresh(ADDR, {
      historyComplete: false,
      score: 40,
      uniqueDays: 5,
      txCount: 50,
    });
    expect(isAnalysisFresh(ADDR)).toBe(true);
    // Incomplete history must continue refining on reopen.
    expect(shouldSkipBackgroundRescan(ADDR)).toBe(false);
  });

  it("respects max age", () => {
    markAnalysisFresh(ADDR, {
      historyComplete: true,
      score: 40,
    });
    // Zero max age → never treated as fresh
    expect(isAnalysisFresh(ADDR, 0)).toBe(false);
    expect(ANALYSIS_FRESH_MS).toBeGreaterThan(60_000);
  });
});
