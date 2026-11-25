import { describe, expect, it } from "vitest";
import { createRulesFilter, type RulesFilterDeps, type StoredEntry, type StoredHold } from "@/limit-orders/keeper/rulesFilter";
import type { PlanRules, PricePoint } from "@/limit-orders/shared/planRules";

const DAY = 86_400;
const BOOK = "0x080D52b060A467aE63d7d2cC7178dc6B1A3DB29D";
const OWNER = "0xaBCdEf0000000000000000000000000000000001";
const STOCK = "0xb20000000000000000000078ee7ce2fe4908108c";
const plan = { owner: OWNER, stockToken: STOCK };
const P = (...ids: string[]) => ids.map((id) => ({ id, owner: OWNER }));

let clock = new Date("2026-11-24T15:00:00Z"); // Tuesday 10:00 US Eastern
const flat = (days: number, p = 100): PricePoint[] => Array.from({ length: days }, (_, i) => ({ t: Math.floor(clock.getTime() / 1000) - (i + 1) * DAY, c: p }));

function entry(rules: PlanRules | null, over: Partial<StoredEntry> = {}): StoredEntry {
  return { rules, issuedAt: 1, signer: OWNER.toLowerCase(), signature: "0xsig", ...over };
}

function setup(entries: Record<string, StoredEntry>, over: Partial<RulesFilterDeps> = {}, enabled = true) {
  const logs: string[] = [];
  const calls = { fetch: 0, verify: 0, price: 0, history: 0 };
  const deps: RulesFilterDeps = {
    fetchEntries: async () => (calls.fetch++, { entries, holds: {} }),
    verify: async () => (calls.verify++, true),
    readPrice: async () => (calls.price++, 100),
    fetchHistory: async () => (calls.history++, flat(40)),
    now: () => clock,
    log: (m) => logs.push(m),
    ...over,
  };
  const f = createRulesFilter({ enabled, chainId: 8453, orderBook: BOOK }, deps);
  return { f, logs, calls };
}

describe("rules filter", () => {
  it("does nothing when switched off", async () => {
    const { f, calls } = setup({ "1": entry({ v: 1, weekdays: [0] }) }, {}, false);
    await f.refresh(P("1"));
    expect(await f.check("1", plan)).toEqual({ run: true });
    expect(calls.fetch).toBe(0);
  });

  it("runs plans that have no rules, or whose rules were removed", async () => {
    const { f } = setup({ "2": entry(null) });
    await f.refresh(P("1", "2"));
    expect(await f.check("1", plan)).toEqual({ run: true });
    expect(await f.check("2", plan)).toEqual({ run: true });
  });

  it("holds a run on the wrong weekday and allows it on the right one", async () => {
    const { f } = setup({ "1": entry({ v: 1, weekdays: [3] }) }); // Wednesdays
    await f.refresh(P("1"));
    const d = await f.check("1", plan);
    expect(d.run).toBe(false);
    clock = new Date("2026-11-25T15:00:00Z"); // Wednesday
    expect(await f.check("1", plan)).toEqual({ run: true });
    clock = new Date("2026-11-24T15:00:00Z");
  });

  it("ignores a rule set whose signature does not check out (a tampered store cannot hold plans back)", async () => {
    const { f, logs } = setup({ "1": entry({ v: 1, weekdays: [3] }) }, { verify: async () => false });
    await f.refresh(P("1"));
    expect(await f.check("1", plan)).toEqual({ run: true });
    expect(logs.some((l) => /failed the signature check/.test(l))).toBe(true);
  });

  it("ignores a rule set signed by someone other than the plan owner", async () => {
    const { f } = setup({ "1": entry({ v: 1, weekdays: [3] }, { signer: "0x0000000000000000000000000000000000000bad" }) });
    await f.refresh(P("1"));
    expect(await f.check("1", plan)).toEqual({ run: true });
  });

  it("ignores a stored rule set that no longer validates", async () => {
    const { f } = setup({ "1": entry({ v: 1, dip: { refDays: 99 } } as unknown as PlanRules) });
    await f.refresh(P("1"));
    expect(await f.check("1", plan)).toEqual({ run: true });
  });

  it("checks the signature once per rule set, not every poll", async () => {
    const { f, calls } = setup({ "1": entry({ v: 1, weekdays: [2] }) });
    await f.refresh(P("1"));
    for (let i = 0; i < 5; i++) await f.check("1", plan);
    expect(calls.verify).toBe(1);
  });

  it("dip rule uses the live price and the history", async () => {
    const dip: PlanRules = { v: 1, dip: { refDays: 7, minDropPct: 5 } };
    const high = setup({ "1": entry(dip) }, { readPrice: async () => 99 });
    await high.f.refresh(P("1"));
    expect((await high.f.check("1", plan)).run).toBe(false);
    const low = setup({ "1": entry(dip) }, { readPrice: async () => 90 });
    await low.f.refresh(P("1"));
    expect(await low.f.check("1", plan)).toEqual({ run: true });
  });

  it("waits (fails closed) when a price rule cannot be checked", async () => {
    const dip: PlanRules = { v: 1, dip: { refDays: 7, minDropPct: 5 } };
    const noPrice = setup({ "1": entry(dip) }, { readPrice: async () => null });
    await noPrice.f.refresh(P("1"));
    expect((await noPrice.f.check("1", plan)).run).toBe(false);
    const noHistory = setup({ "1": entry(dip) }, { fetchHistory: async () => { throw new Error("down"); } });
    await noHistory.f.refresh(P("1"));
    expect((await noHistory.f.check("1", plan)).run).toBe(false);
  });

  it("does not fetch price or history for time-only rules", async () => {
    const { f, calls } = setup({ "1": entry({ v: 1, weekdays: [2] }) });
    await f.refresh(P("1"));
    await f.check("1", plan);
    expect(calls.price + calls.history).toBe(0);
  });

  it("caches history between polls", async () => {
    const { f, calls } = setup({ "1": entry({ v: 1, dip: { refDays: 7, minDropPct: 1 } }) });
    await f.refresh(P("1"));
    await f.check("1", plan);
    await f.check("1", plan);
    expect(calls.history).toBe(1);
  });

  it("keeps the rules it already knows when the store goes down, and says so once", async () => {
    let up = true;
    const { f, logs } = setup({ "1": entry({ v: 1, weekdays: [3] }) }, {
      fetchEntries: async () => {
        if (!up) throw new Error("503");
        return { entries: { "1": entry({ v: 1, weekdays: [3] }) }, holds: {} };
      },
    });
    await f.refresh(P("1"));
    up = false;
    clock = new Date(clock.getTime() + 61_000);
    await f.refresh(P("1"));
    clock = new Date(clock.getTime() + 61_000);
    await f.refresh(P("1"));
    expect((await f.check("1", plan)).run).toBe(false); // still held by the rule it knew
    expect(logs.filter((l) => /unreachable/.test(l)).length).toBe(1);
    up = true;
    clock = new Date(clock.getTime() + 61_000);
    await f.refresh(P("1"));
    expect(logs.some((l) => /reachable again/.test(l))).toBe(true);
    clock = new Date("2026-11-24T15:00:00Z");
  });

  it("asks the store at most once a minute", async () => {
    const { f, calls } = setup({});
    await f.refresh(P("1"));
    await f.refresh(P("1"));
    await f.refresh(P("1"));
    expect(calls.fetch).toBe(1);
    clock = new Date(clock.getTime() + 61_000);
    await f.refresh(P("1"));
    expect(calls.fetch).toBe(2);
    clock = new Date("2026-11-24T15:00:00Z");
  });

  it("logs a decision only when it changes", async () => {
    const { f, logs } = setup({ "1": entry({ v: 1, weekdays: [3] }) });
    await f.refresh(P("1"));
    await f.check("1", plan);
    await f.check("1", plan);
    await f.check("1", plan);
    expect(logs.filter((l) => /waiting/.test(l)).length).toBe(1);
  });
});

describe("first-buy hold", () => {
  const nowSec = () => Math.floor(clock.getTime() / 1000);
  const hold = (over: Partial<StoredHold> = {}): StoredHold => ({ from: "5", issuedAt: nowSec() - 60, until: nowSec() + 1740, signature: "0xhold", ...over });
  const withHold = (h: StoredHold, entries: Record<string, StoredEntry> = {}, over: Partial<RulesFilterDeps> = {}) =>
    setup(entries, { fetchEntries: async () => ({ entries, holds: { [OWNER.toLowerCase()]: h } }), ...over });

  it("holds a covered new plan that has no rules yet", async () => {
    const { f, logs } = withHold(hold());
    await f.refresh(P("5"));
    const d = await f.check("5", plan);
    expect(d.run).toBe(false);
    expect(logs.some((l) => /choosing rules/.test(l))).toBe(true);
  });

  it("leaves older plans alone", async () => {
    const { f } = withHold(hold());
    await f.refresh(P("4"));
    expect(await f.check("4", plan)).toEqual({ run: true });
  });

  it("ends when the owner chooses no rules, and gives way to saved rules", async () => {
    const none = withHold(hold(), { "5": entry(null) });
    await none.f.refresh(P("5"));
    expect(await none.f.check("5", plan)).toEqual({ run: true });
    const allowToday = withHold(hold(), { "5": entry({ v: 1, weekdays: [2] }) });
    await allowToday.f.refresh(P("5"));
    expect(await allowToday.f.check("5", plan)).toEqual({ run: true });
    const notToday = withHold(hold(), { "5": entry({ v: 1, weekdays: [3] }) });
    await notToday.f.refresh(P("5"));
    expect((await notToday.f.check("5", plan)).run).toBe(false);
  });

  it("runs out by itself", async () => {
    const { f } = withHold(hold({ until: nowSec() + 30 }));
    await f.refresh(P("5"));
    expect((await f.check("5", plan)).run).toBe(false);
    clock = new Date(clock.getTime() + 31_000);
    expect(await f.check("5", plan)).toEqual({ run: true });
    clock = new Date("2026-11-24T15:00:00Z");
  });

  it("ignores a hold that is longer than an hour, or whose signature fails", async () => {
    const long = withHold(hold({ issuedAt: nowSec(), until: nowSec() + 7200 }));
    await long.f.refresh(P("5"));
    expect(await long.f.check("5", plan)).toEqual({ run: true });
    const forged = withHold(hold(), {}, { verify: async () => false });
    await forged.f.refresh(P("5"));
    expect(await forged.f.check("5", plan)).toEqual({ run: true });
    expect(forged.logs.some((l) => /hold failed the signature check/.test(l))).toBe(true);
  });

  it("a forged 'no rules' entry cannot end a genuine hold", async () => {
    const { f } = withHold(hold(), { "5": entry(null, { signature: "0xforged" }) }, { verify: async (a) => a.signature === "0xhold" });
    await f.refresh(P("5"));
    expect((await f.check("5", plan)).run).toBe(false);
  });

  it("does not apply to another owner's plan", async () => {
    const { f } = withHold(hold());
    await f.refresh(P("5"));
    expect(await f.check("5", { ...plan, owner: "0x0000000000000000000000000000000000000002" })).toEqual({ run: true });
  });
});

describe("brand-new plans", () => {
  it("looks a new plan up right away instead of waiting a minute", async () => {
    const { f, calls } = setup({});
    await f.refresh(P("1"));
    clock = new Date(clock.getTime() + 5_000);
    await f.refresh(P("1"));
    expect(calls.fetch).toBe(1); // nothing new: still once a minute
    await f.refresh(P("1", "2"));
    expect(calls.fetch).toBe(2); // plan 2 is new
    clock = new Date("2026-11-24T15:00:00Z");
  });

  it("does not run a plan it has not looked up, then runs it if the store stays down", async () => {
    const { f } = setup({}, { fetchEntries: async () => { throw new Error("down"); } });
    await f.refresh(P("9"));
    expect((await f.check("9", plan)).run).toBe(false);
    clock = new Date(clock.getTime() + 119_000);
    expect((await f.check("9", plan)).run).toBe(false);
    clock = new Date(clock.getTime() + 2_000);
    expect(await f.check("9", plan)).toEqual({ run: true });
    clock = new Date("2026-11-24T15:00:00Z");
  });
});
