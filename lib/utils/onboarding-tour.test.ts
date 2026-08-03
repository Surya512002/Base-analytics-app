import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  armGuideReplay,
  consumeGuideReplay,
  isExploreTourDone,
  isMainTourDone,
  markMainTourDone,
  peekGuideReplay,
  resetGuidesForReplay,
} from "@/lib/utils/onboarding-tour";

function mockBrowserStorage() {
  const store = new Map<string, string>();
  const session = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => session.set(key, value),
    removeItem: (key: string) => session.delete(key),
    clear: () => session.clear(),
  });
}

describe("onboarding-tour", () => {
  beforeEach(() => {
    mockBrowserStorage();
  });

  it("marks main tour done and suppresses explore", () => {
    expect(isMainTourDone()).toBe(false);
    markMainTourDone();
    expect(isMainTourDone()).toBe(true);
    expect(isExploreTourDone()).toBe(true);
  });

  it("does not let explore consume a main replay arm", () => {
    armGuideReplay("main");
    expect(peekGuideReplay()).toBe("main");
    expect(consumeGuideReplay("explore")).toBeNull();
    expect(peekGuideReplay()).toBe("main");
    expect(consumeGuideReplay("main")).toBe("main");
    expect(peekGuideReplay()).toBeNull();
  });

  it("resetGuidesForReplay clears flags", () => {
    markMainTourDone();
    resetGuidesForReplay("all");
    expect(isMainTourDone()).toBe(false);
    expect(isExploreTourDone()).toBe(false);
  });
});
