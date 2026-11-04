import { describe, it, expect, beforeEach } from "vitest";
import {
  PRESET_SMART_MONEY,
  readFollowedSmartMoney,
  followSmartMoney,
  unfollowSmartMoney,
  _resetMemoryStoreForTesting,
} from "@/lib/smart-money/smart-money-store";

describe("Smart Money Radar Store", () => {
  beforeEach(() => {
    _resetMemoryStoreForTesting();
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("provides valid Base preset wallets with verified tags", () => {
    expect(PRESET_SMART_MONEY.length).toBeGreaterThanOrEqual(3);
    for (const wallet of PRESET_SMART_MONEY) {
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(wallet.label.length).toBeGreaterThan(0);
      expect(wallet.tag.length).toBeGreaterThan(0);
      expect(wallet.isPreset).toBe(true);
    }
  });

  it("reads followed smart money returning presets by default", () => {
    const wallets = readFollowedSmartMoney("0x1234567890123456789012345678901234567890");
    expect(wallets.length).toBe(PRESET_SMART_MONEY.length);
    expect(wallets[0].address).toBe(PRESET_SMART_MONEY[0].address);
  });

  it("adds and persists a new custom smart money address", () => {
    const user = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const target = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    const updated = followSmartMoney(user, {
      address: target,
      label: "Alpha Fund",
      tag: "DeFi Fund",
    });

    expect(updated.length).toBe(PRESET_SMART_MONEY.length + 1);
    const added = updated.find((w) => w.address.toLowerCase() === target.toLowerCase());
    expect(added).toBeDefined();
    expect(added?.label).toBe("Alpha Fund");
    expect(added?.tag).toBe("DeFi Fund");
    expect(added?.isPreset).toBe(false);

    // Reading back from storage returns the added wallet
    const reloaded = readFollowedSmartMoney(user);
    expect(reloaded.length).toBe(PRESET_SMART_MONEY.length + 1);
  });

  it("prevents duplicate wallet additions", () => {
    const user = "0xcccccccccccccccccccccccccccccccccccccccc";
    const target = "0xdddddddddddddddddddddddddddddddddddddddd";

    followSmartMoney(user, { address: target, label: "Whale 1" });
    const duplicateAdd = followSmartMoney(user, { address: target, label: "Whale 1 duplicate" });

    expect(duplicateAdd.filter((w) => w.address.toLowerCase() === target.toLowerCase()).length).toBe(1);
  });

  it("unfollows custom wallet while preserving presets", () => {
    const user = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    const target = "0xffffffffffffffffffffffffffffffffffffffff";

    followSmartMoney(user, { address: target, label: "Temp Whale" });
    const afterUnfollow = unfollowSmartMoney(user, target);

    expect(afterUnfollow.some((w) => w.address.toLowerCase() === target.toLowerCase())).toBe(false);
    expect(afterUnfollow.length).toBe(PRESET_SMART_MONEY.length);
  });
});
