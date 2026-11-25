import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";
import { rulesMessage, type PlanRules } from "@/limit-orders/shared/planRules";
import type { RulesDeps, StoredHold, StoredRules } from "@/lib/plans/rules-service";
import { saveFirstBuyHold } from "@/lib/plans/hold-client";

const owner = privateKeyToAccount(("0x" + "33".repeat(32)) as `0x${string}`);
const BOOK = "0x080D52b060A467aE63d7d2cC7178dc6B1A3DB29D";
const store = new Map<string, StoredRules>();
const holds = new Map<string, StoredHold>();

vi.mock("@/lib/api/rate-limit", () => ({ limitByIp: async () => null }));
vi.mock("@/lib/plans/rules-deps", () => {
  const deps: RulesDeps = {
    nowSec: () => Math.floor(Date.now() / 1000),
    orderBookFor: (c) => (c === 8453 ? BOOK : null),
    readPlan: async (_c, id) => (id === "5" ? { owner: owner.address, status: 1 } : null),
    verify: async ({ address, message, signature }) => verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` }),
    load: async (c, id) => store.get(`${c}:${id}`) ?? null,
    save: async (c, id, e) => (store.set(`${c}:${id}`, e), true),
    loadHold: async (c, o) => holds.get(`${c}:${o.toLowerCase()}`) ?? null,
    saveHold: async (c, o, h) => (holds.set(`${c}:${o.toLowerCase()}`, h), true),
  };
  return { realDeps: deps, orderBookFor: deps.orderBookFor, readStored: deps.load, readHold: deps.loadHold };
});

const TOKEN = "k".repeat(32);
const rules: PlanRules = { v: 1, weekdays: [2], dip: { refDays: 7, minDropPct: 5 } };

async function post(body: unknown, raw?: string) {
  const { POST } = await import("@/app/api/plans/rules/route");
  return POST(new Request("http://x/api/plans/rules", { method: "POST", body: raw ?? JSON.stringify(body) }));
}
async function get(qs: string, auth?: string) {
  const { GET } = await import("@/app/api/plans/rules/route");
  return GET(new Request(`http://x/api/plans/rules?${qs}`, { headers: auth ? { authorization: auth } : {} }));
}
async function goodBody(r: PlanRules | null = rules, issuedAt = Math.floor(Date.now() / 1000)) {
  const signature = await owner.signMessage({ message: rulesMessage({ chainId: 8453, orderBook: BOOK, planId: "5", rules: r, issuedAt }) });
  return { chainId: 8453, planId: "5", rules: r, issuedAt, signature };
}

describe("/api/plans/rules", () => {
  beforeEach(() => {
    store.clear();
    holds.clear();
    process.env.KEEPER_RULES_TOKEN = TOKEN;
  });
  afterEach(() => {
    delete process.env.KEEPER_RULES_TOKEN;
  });

  it("saves signed rules, and a single plan can be read back without a token", async () => {
    expect((await post(await goodBody())).status).toBe(200);
    const res = await get("chainId=8453&planId=5");
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.rules).toEqual(rules);
    expect(j.signature).toBeUndefined(); // the public read never returns the signature
  });

  it("refuses invalid JSON and oversized bodies", async () => {
    expect((await post(null, "{not json")).status).toBe(400);
    expect((await post(null, JSON.stringify({ pad: "x".repeat(5000) }))).status).toBe(413);
  });

  it("refuses a bad signature with 401 and stores nothing", async () => {
    const body = await goodBody();
    const res = await post({ ...body, rules: { v: 1, weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    expect(res.status).toBe(401);
    expect(store.size).toBe(0);
  });

  it("bulk read needs the keeper token", async () => {
    await post(await goodBody());
    expect((await get("chainId=8453&ids=5")).status).toBe(401);
    expect((await get("chainId=8453&ids=5", "Bearer wrong".padEnd(40, "x"))).status).toBe(401);
    const ok = await get("chainId=8453&ids=5,6", `Bearer ${TOKEN}`);
    expect(ok.status).toBe(200);
    const j = await ok.json();
    expect(Object.keys(j.entries)).toEqual(["5"]);
    expect(j.entries["5"].signature).toMatch(/^0x/);
  });

  it("bulk read is disabled when no token is configured or the token is short", async () => {
    delete process.env.KEEPER_RULES_TOKEN;
    expect((await get("chainId=8453&ids=5", "Bearer anything")).status).toBe(503);
    process.env.KEEPER_RULES_TOKEN = "short";
    expect((await get("chainId=8453&ids=5", "Bearer short")).status).toBe(503);
  });

  it("validates query input", async () => {
    expect((await get("chainId=1&planId=5")).status).toBe(400);
    expect((await get("chainId=8453&planId=abc")).status).toBe(400);
    expect((await get("chainId=8453&ids=1,abc", `Bearer ${TOKEN}`)).status).toBe(400);
    expect((await get("chainId=8453&ids=", `Bearer ${TOKEN}`)).status).toBe(400);
    const many = Array.from({ length: 201 }, (_, i) => i + 1).join(",");
    expect((await get(`chainId=8453&ids=${many}`, `Bearer ${TOKEN}`)).status).toBe(400);
  });
});

describe("/api/plans/hold with the browser helper", () => {
  beforeEach(() => {
    holds.clear();
    store.clear();
    process.env.KEEPER_RULES_TOKEN = TOKEN;
  });
  afterEach(() => {
    delete process.env.KEEPER_RULES_TOKEN;
  });

  /** Routes the helper's fetch calls to the real handlers. */
  const viaRoutes: typeof fetch = async (input, init) => {
    const { GET, POST } = await import("@/app/api/plans/hold/route");
    const req = new Request(`http://x${String(input)}`, init);
    return init?.method === "POST" ? POST(req) : GET(req);
  };
  const call = (nextPlanId: bigint, nowSec = Math.floor(Date.now() / 1000)) =>
    saveFirstBuyHold({ chainId: 8453, orderBook: BOOK, owner: owner.address, nextPlanId, sign: (message) => owner.signMessage({ message }), fetchImpl: viaRoutes, nowSec });

  it("what the browser signs is what the server accepts, and the keeper can read it with the token", async () => {
    const now = Math.floor(Date.now() / 1000);
    expect(await call(7n, now)).toEqual({ from: "7", until: now + 1800 });
    const res = await get(`chainId=8453&ids=7&owners=${owner.address}`, `Bearer ${TOKEN}`);
    const j = await res.json();
    expect(j.holds[owner.address.toLowerCase()]).toMatchObject({ from: "7" });
    expect(j.holds[owner.address.toLowerCase()].signature).toMatch(/^0x/);
  });

  it("a second hold keeps covering the earlier plans", async () => {
    const now = Math.floor(Date.now() / 1000);
    await call(7n, now - 5);
    expect((await call(12n, now)).from).toBe("7");
  });

  it("reports the server's reason when it refuses", async () => {
    await expect(
      saveFirstBuyHold({ chainId: 8453, orderBook: BOOK, owner: owner.address, nextPlanId: 7n, sign: (message) => privateKeyToAccount(`0x${"44".repeat(32)}`).signMessage({ message }), fetchImpl: viaRoutes })
    ).rejects.toThrow(/does not match/);
  });

  it("holds are only in the keeper read with the token, and bad owners are refused", async () => {
    await call(7n);
    expect((await get(`chainId=8453&ids=7&owners=${owner.address}`)).status).toBe(401);
    expect((await get("chainId=8453&ids=7&owners=abc", `Bearer ${TOKEN}`)).status).toBe(400);
  });
});
