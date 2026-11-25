import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";
import { holdCovers, holdMessage, rulesMessage, type PlanRules } from "@/limit-orders/shared/planRules";
import { entryIsAuthentic, submitHold, submitRules, type RulesDeps, type StoredHold, type StoredRules } from "@/lib/plans/rules-service";

const owner = privateKeyToAccount(("0x" + "11".repeat(32)) as `0x${string}`);
const stranger = privateKeyToAccount(("0x" + "22".repeat(32)) as `0x${string}`);
const BOOK = "0x080D52b060A467aE63d7d2cC7178dc6B1A3DB29D";
const NOW = 1_800_000_000;
const rules: PlanRules = { v: 1, weekdays: [2], window: { startMin: 570, endMin: 630 } };

function makeDeps(over: Partial<RulesDeps> = {}) {
  const store = new Map<string, StoredRules>();
  const holds = new Map<string, StoredHold>();
  const deps: RulesDeps = {
    loadHold: async (c, o) => holds.get(`${c}:${o.toLowerCase()}`) ?? null,
    saveHold: async (c, o, h) => (holds.set(`${c}:${o.toLowerCase()}`, h), true),
    nowSec: () => NOW,
    orderBookFor: (c) => (c === 8453 ? BOOK : null),
    readPlan: async (_c, id) => (id === "7" ? { owner: owner.address, status: 1 } : id === "8" ? { owner: owner.address, status: 3 } : null),
    verify: async ({ address, message, signature }) => verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` }),
    load: async (c, id) => store.get(`${c}:${id}`) ?? null,
    save: async (c, id, e) => (store.set(`${c}:${id}`, e), true),
    ...over,
  };
  return { deps, store, holds };
}

async function signed(a: { signer?: typeof owner; planId?: string; chainId?: number; r?: PlanRules | null; issuedAt?: number; messageRules?: PlanRules | null }) {
  const planId = a.planId ?? "7";
  const chainId = a.chainId ?? 8453;
  const issuedAt = a.issuedAt ?? NOW;
  const r = a.r === undefined ? rules : a.r;
  const message = rulesMessage({ chainId, orderBook: BOOK, planId, rules: a.messageRules === undefined ? r : a.messageRules, issuedAt });
  const signature = await (a.signer ?? owner).signMessage({ message });
  return { chainId, planId, rules: r, issuedAt, signature };
}

describe("submitRules", () => {
  it("accepts rules signed by the plan owner and stores them", async () => {
    const { deps, store } = makeDeps();
    const r = await submitRules(await signed({}), deps);
    expect(r.ok).toBe(true);
    expect(store.get("8453:7")?.signer).toBe(owner.address.toLowerCase());
    expect(store.get("8453:7")?.rules).toEqual(rules);
  });

  it("refuses a signature from someone who is not the plan owner", async () => {
    const { deps, store } = makeDeps();
    const r = await submitRules(await signed({ signer: stranger }), deps);
    expect(r).toMatchObject({ ok: false, status: 401 });
    expect(store.size).toBe(0);
  });

  it("refuses when the signed text differs from the submitted rules (swapped rules)", async () => {
    const { deps } = makeDeps();
    const body = await signed({ r: { v: 1, weekdays: [2, 3, 4, 5] }, messageRules: rules });
    expect(await submitRules(body, deps)).toMatchObject({ ok: false, status: 401 });
  });

  it("a signature for another plan, another chain or another time does not transfer", async () => {
    const { deps } = makeDeps();
    const good = await signed({});
    expect(await submitRules({ ...good, planId: "9" }, deps)).toMatchObject({ ok: false });
    expect(await submitRules({ ...good, issuedAt: NOW + 1 }, deps)).toMatchObject({ ok: false, status: 401 });
    const other = await signed({ chainId: 84532 });
    expect(await submitRules({ ...other, chainId: 8453 }, deps)).toMatchObject({ ok: false, status: 401 });
  });

  it("refuses stale or future-dated signatures", async () => {
    const { deps } = makeDeps();
    expect(await submitRules(await signed({ issuedAt: NOW - 601 }), deps)).toMatchObject({ ok: false, status: 400 });
    expect(await submitRules(await signed({ issuedAt: NOW + 601 }), deps)).toMatchObject({ ok: false, status: 400 });
  });

  it("refuses replaying an older or equal signature after a newer one was saved", async () => {
    const { deps } = makeDeps();
    const first = await signed({ issuedAt: NOW - 60 });
    const second = await signed({ issuedAt: NOW, r: { v: 1, weekdays: [3] } });
    expect((await submitRules(second, deps)).ok).toBe(true);
    expect(await submitRules(first, deps)).toMatchObject({ ok: false, status: 409 });
    expect(await submitRules(second, deps)).toMatchObject({ ok: false, status: 409 });
  });

  it("refuses unknown, finished or cancelled plans", async () => {
    const { deps } = makeDeps();
    expect(await submitRules(await signed({ planId: "999" }), deps)).toMatchObject({ ok: false, status: 404 });
    expect(await submitRules(await signed({ planId: "8" }), deps)).toMatchObject({ ok: false, status: 409 });
  });

  it("validates before touching the chain: bad rules, plan ids, chains, signatures", async () => {
    const { deps } = makeDeps({ readPlan: async () => { throw new Error("must not be called"); } });
    const ok = await signed({});
    expect(await submitRules({ ...ok, rules: { v: 1 } }, deps)).toMatchObject({ ok: false, status: 400 });
    expect(await submitRules({ ...ok, planId: "0" }, deps)).toMatchObject({ ok: false, status: 400 });
    expect(await submitRules({ ...ok, planId: "1e9" }, deps)).toMatchObject({ ok: false, status: 400 });
    expect(await submitRules({ ...ok, planId: 7 }, deps)).toMatchObject({ ok: false, status: 400 });
    expect(await submitRules({ ...ok, chainId: 1 }, deps)).toMatchObject({ ok: false, status: 400 });
    expect(await submitRules({ ...ok, signature: "0x12" }, deps)).toMatchObject({ ok: false, status: 400 });
    expect(await submitRules(null, deps)).toMatchObject({ ok: false, status: 400 });
    expect(await submitRules("x", deps)).toMatchObject({ ok: false, status: 400 });
  });

  it("a signed removal deletes the rules", async () => {
    const { deps, store } = makeDeps();
    await submitRules(await signed({ issuedAt: NOW - 30 }), deps);
    const r = await submitRules(await signed({ r: null, issuedAt: NOW }), deps);
    expect(r).toEqual({ ok: true, rules: null });
    expect(store.get("8453:7")?.rules).toBeNull();
  });

  it("reports a storage failure instead of pretending it saved", async () => {
    const { deps } = makeDeps({ save: async () => false });
    expect(await submitRules(await signed({}), deps)).toMatchObject({ ok: false, status: 503 });
  });
});

describe("entryIsAuthentic (what the keeper checks)", () => {
  const verify = makeDeps().deps.verify;
  const ctx = { chainId: 8453, orderBook: BOOK, planId: "7", owner: owner.address };

  async function entry(over: Partial<StoredRules> = {}): Promise<StoredRules> {
    const b = await signed({});
    return { rules, issuedAt: NOW, signer: owner.address.toLowerCase(), signature: b.signature, ...over };
  }

  it("accepts a genuine entry", async () => {
    expect(await entryIsAuthentic(await entry(), ctx, verify)).toBe(true);
  });
  it("rejects an entry whose rules were edited in the store", async () => {
    expect(await entryIsAuthentic(await entry({ rules: { v: 1, weekdays: [0] } }), ctx, verify)).toBe(false);
  });
  it("rejects an entry signed by someone else, or that names a different signer", async () => {
    const b = await signed({ signer: stranger });
    expect(await entryIsAuthentic(await entry({ signature: b.signature }), ctx, verify)).toBe(false);
    expect(await entryIsAuthentic(await entry({ signer: stranger.address.toLowerCase() }), ctx, verify)).toBe(false);
  });
  it("rejects an entry copied to a different plan", async () => {
    expect(await entryIsAuthentic(await entry(), { ...ctx, planId: "8" }, verify)).toBe(false);
  });
});

describe("submitHold", () => {
  async function body(over: Partial<{ from: string; until: number; issuedAt: number; signer: typeof owner; chainId: number }> = {}) {
    const a = { chainId: 8453, from: "5", issuedAt: NOW, until: NOW + 1800, signer: owner, ...over };
    const message = holdMessage({ chainId: a.chainId, orderBook: BOOK, owner: owner.address, from: a.from, until: a.until, issuedAt: a.issuedAt });
    return { chainId: a.chainId, owner: owner.address, from: a.from, until: a.until, issuedAt: a.issuedAt, signature: await a.signer.signMessage({ message }) };
  }

  it("stores a hold the owner signed", async () => {
    const { deps, holds } = makeDeps();
    expect(await submitHold(await body(), deps)).toEqual({ ok: true, from: "5", until: NOW + 1800 });
    expect(holds.size).toBe(1);
  });

  it("refuses someone else's signature, and edited fields", async () => {
    const { deps, holds } = makeDeps();
    expect(await submitHold(await body({ signer: stranger }), deps)).toMatchObject({ ok: false, status: 401 });
    const good = await body();
    expect(await submitHold({ ...good, from: "1" }, deps)).toMatchObject({ ok: false, status: 401 });
    expect(await submitHold({ ...good, until: NOW + 3600 }, deps)).toMatchObject({ ok: false, status: 401 });
    expect(await submitHold({ ...good, owner: stranger.address }, deps)).toMatchObject({ ok: false, status: 401 });
    expect(holds.size).toBe(0);
  });

  it("refuses holds over an hour, already over, stale, or malformed", async () => {
    const { deps } = makeDeps();
    expect(await submitHold(await body({ until: NOW + 3601 }), deps)).toMatchObject({ ok: false, status: 400 });
    expect(await submitHold(await body({ until: NOW }), deps)).toMatchObject({ ok: false, status: 400 });
    expect(await submitHold(await body({ issuedAt: NOW - 601 }), deps)).toMatchObject({ ok: false, status: 400 });
    const good = await body();
    expect(await submitHold({ ...good, owner: "0x12" }, deps)).toMatchObject({ ok: false, status: 400 });
    expect(await submitHold({ ...good, from: "0" }, deps)).toMatchObject({ ok: false, status: 400 });
    expect(await submitHold({ ...good, chainId: 1 }, deps)).toMatchObject({ ok: false, status: 400 });
    expect(await submitHold(null, deps)).toMatchObject({ ok: false, status: 400 });
  });

  it("refuses replaying an older request after a newer one", async () => {
    const { deps } = makeDeps();
    const older = await body({ issuedAt: NOW - 30, from: "2" });
    expect((await submitHold(await body(), deps)).ok).toBe(true);
    expect(await submitHold(older, deps)).toMatchObject({ ok: false, status: 409 });
  });
});

describe("holdCovers", () => {
  const h = { from: "10", issuedAt: NOW, until: NOW + 1800 };
  it("covers the first plan and later ones while running", () => {
    expect(holdCovers(h, "10", NOW)).toBe(true);
    expect(holdCovers(h, "250", NOW + 1799)).toBe(true);
    expect(holdCovers(h, "9", NOW)).toBe(false);
    expect(holdCovers(h, "10", NOW + 1800)).toBe(false);
  });
  it("never covers anything when over an hour long or malformed", () => {
    expect(holdCovers({ ...h, until: NOW + 3601 }, "10", NOW)).toBe(false);
    expect(holdCovers({ ...h, from: "x" }, "10", NOW)).toBe(false);
    expect(holdCovers(h, "1e3", NOW)).toBe(false);
  });
});
