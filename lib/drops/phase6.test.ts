import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { recoverMessageAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) => (host === "internal.example.com" ? [{ address: "10.0.0.5", family: 4 }] : [{ address: "93.184.216.34", family: 4 }])),
}));

import { createMemoryKv } from "./kv";
import { computeReward, drawWinners, maxPossibleReward, nextStreak, raffleCommit, streakMultiplierBps } from "./rewards";
import { assertPublicHttpsUrl, liveCode, liveCodeTask, referralsTask, webhookTask } from "./tasks/community";
import { basenameTask, walletAgeTask } from "./tasks/identity";
import { ticketInnerHash } from "./chain";
import { checkTask, decideReview, drawRaffle, enterRaffle, issueTicket, raffleStatus, saveDefinition, type DropDeps } from "./service";
import type { TaskContext } from "./types";

const ALICE = "0x00000000000000000000000000000000000a11ce" as const;
const BOB = "0x0000000000000000000000000000000000000b0b" as const;
const CAROL = "0x0000000000000000000000000000000000000c0c" as const;
const CREATOR = "0x00000000000000000000000000000000c0ffee00" as const;
const DROPS = "0x1111111111111111111111111111111111111111" as const;
const DROP_ID = BigInt(2_000_000_001);
const SIGNER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const h32 = (b: string) => `0x${b.repeat(32)}` as `0x${string}`;
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

function ctx(over: Partial<TaskContext> = {}): TaskContext {
  return {
    chainId: 8453,
    dropsContract: DROPS,
    dropId: DROP_ID,
    dropCreatedAt: 1_700_000_000,
    taskId: "t1",
    claimer: ALICE,
    now: 1_700_100_000,
    client: { readContract: async () => BigInt(0), getCode: async () => undefined },
    fetch: (async () => json({})) as typeof fetch,
    env: { explorerKey: "k" },
    kv: createMemoryKv(),
    ...over,
  };
}

// ───────────────────────────── rewards ─────────────────────────────

describe("rewards", () => {
  const rules = { mode: "fixed" as const, streak: { bonusBps: 1000, maxDays: 5, windowHours: 48 } };

  it("streak grows within the window, resets after it, and needs the previous claim's ticket", () => {
    const base = { now: 1_000_000, windowHours: 48 };
    expect(nextStreak({ ...base, claimIndex: 0, lastClaimAt: 0, prev: null })).toBe(1);
    expect(nextStreak({ ...base, claimIndex: 3, lastClaimAt: 1_000_000 - 30 * 3600, prev: { forClaimIndex: 2, streak: 4 } })).toBe(5);
    expect(nextStreak({ ...base, claimIndex: 3, lastClaimAt: 1_000_000 - 50 * 3600, prev: { forClaimIndex: 2, streak: 4 } })).toBe(1);
    expect(nextStreak({ ...base, claimIndex: 3, lastClaimAt: 1_000_000 - 3600, prev: { forClaimIndex: 1, streak: 4 } })).toBe(1);
  });

  it("streak bonus is capped at maxDays and the drop's cap", () => {
    expect(streakMultiplierBps(rules, 1)).toBe(10_000);
    expect(streakMultiplierBps(rules, 3)).toBe(12_000);
    expect(streakMultiplierBps(rules, 99)).toBe(14_000);
    expect(computeReward({ base: BigInt(1000), rules, streak: 3, cap: BigInt(10_000) })).toBe(BigInt(1200));
    expect(computeReward({ base: BigInt(1000), rules, streak: 99, cap: BigInt(1100) })).toBe(BigInt(1100));
    expect(maxPossibleReward(BigInt(1000), rules)).toBe(BigInt(1400));
  });

  it("random amounts stay inside [min, max]", () => {
    const r = { mode: "random" as const, min: "100", max: "200" };
    for (let i = 0; i < 200; i++) {
      const a = computeReward({ base: BigInt(1), rules: r, streak: 1, cap: BigInt(10_000) });
      expect(a >= BigInt(100) && a <= BigInt(200)).toBe(true);
    }
    expect(computeReward({ base: BigInt(1), rules: r, streak: 1, cap: BigInt(10_000), random: () => BigInt(0) })).toBe(BigInt(100));
    expect(maxPossibleReward(BigInt(1), r)).toBe(BigInt(200));
  });

  it("raffle draws are deterministic, unique, order-independent and depend on the block hash", () => {
    const entrants = Array.from({ length: 30 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, "0")}`);
    const seed = h32("ab");
    const a = drawWinners(entrants, 5, seed, h32("01"));
    expect(a).toHaveLength(5);
    expect(new Set(a).size).toBe(5);
    expect(drawWinners([...entrants].reverse(), 5, seed, h32("01"))).toEqual(a);
    expect(drawWinners(entrants, 5, seed, h32("02"))).not.toEqual(a);
    expect(drawWinners(entrants.slice(0, 2), 5, seed, h32("01"))).toHaveLength(2);
    expect(raffleCommit(seed)).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

// ───────────────────────────── community tasks ─────────────────────────────

describe("event code (live_code)", () => {
  const cfg = liveCodeTask.prepare!({ place: "Lisbon" }, { dropKey: "k", taskId: "t1" });

  it("stores a secret that claimers never see", () => {
    expect(cfg.secret).toMatch(/^[0-9a-f]{40}$/);
    expect(liveCodeTask.publicConfig!(cfg)).toEqual({ place: "Lisbon" });
    expect(liveCodeTask.prepare!(cfg, { dropKey: "k", taskId: "t1" })).toEqual(cfg);
  });

  it("accepts the current and previous 30s code only, with limited tries", async () => {
    const now = 1_700_000_015;
    const kv = createMemoryKv();
    const ok = await liveCodeTask.verify(cfg, ctx({ now, kv, submission: { code: liveCode(cfg.secret, now) } }));
    expect(ok.status).toBe("passed");
    expect((await liveCodeTask.verify(cfg, ctx({ now, kv, submission: { code: liveCode(cfg.secret, now - 30) } }))).status).toBe("passed");
    expect((await liveCodeTask.verify(cfg, ctx({ now, kv, submission: { code: liveCode(cfg.secret, now - 90) } }))).status).toBe("failed");
    expect(liveCode(cfg.secret, now)).toMatch(/^\d{6}$/);
    for (let i = 0; i < 3; i++) await liveCodeTask.verify(cfg, ctx({ now, kv, submission: { code: "000000" } }));
    expect((await liveCodeTask.verify(cfg, ctx({ now, kv, submission: { code: liveCode(cfg.secret, now) } }))).message).toContain("Too many");
  });
});

describe("webhook task", () => {
  it("refuses non-public URLs (SSRF)", async () => {
    await expect(assertPublicHttpsUrl("http://example.com/x")).rejects.toThrow();
    await expect(assertPublicHttpsUrl("https://127.0.0.1/x")).rejects.toThrow();
    await expect(assertPublicHttpsUrl("https://localhost/x")).rejects.toThrow();
    await expect(assertPublicHttpsUrl("https://internal.example.com/x")).rejects.toThrow();
    await expect(assertPublicHttpsUrl("https://user:pw@example.com/x")).rejects.toThrow();
    await expect(assertPublicHttpsUrl("https://api.example.com/check")).resolves.toBeInstanceOf(URL);
  });

  it("signs the request and follows the creator's answer", async () => {
    const cfg = webhookTask.configSchema.parse({ url: "https://api.example.com/check", secret: "s".repeat(20), description: "Level 3" });
    let seen: { sig?: string; body?: string } = {};
    const fetchOk = (async (_u: URL | string, init?: RequestInit) => {
      seen = { sig: (init?.headers as Record<string, string>)["x-drops-signature"], body: String(init?.body) };
      return json({ ok: true });
    }) as typeof fetch;
    expect((await webhookTask.verify(cfg, ctx({ fetch: fetchOk }))).status).toBe("passed");
    expect(seen.sig).toBe(createHmac("sha256", "s".repeat(20)).update(seen.body!).digest("hex"));
    expect(JSON.parse(seen.body!).wallet).toBe(ALICE);
    expect((await webhookTask.verify(cfg, ctx({ fetch: (async () => json({ ok: false })) as typeof fetch }))).status).toBe("failed");
    expect(webhookTask.publicConfig!(cfg)).toEqual({ description: "Level 3" });
  });
});

describe("referrals, basename and wallet age", () => {
  it("counts distinct friends from DropClaimed logs, not yourself", async () => {
    const topic = (a: string) => `0x${"0".repeat(24)}${a.slice(2)}`;
    const logs = [BOB, CAROL, BOB, ALICE].map((c) => ({ topics: ["0x", "0x", topic(c), topic(ALICE)] }));
    const cfg = referralsTask.configSchema.parse({ minFriends: 2 });
    const r = await referralsTask.verify(cfg, ctx({ fetch: (async () => json({ status: "1", result: logs })) as typeof fetch }));
    expect(r).toMatchObject({ status: "passed", evidence: { friends: 2 } });
    expect((await referralsTask.verify(cfg, ctx({ env: {} }))).status).toBe("unavailable");
  });

  it("basename: holds the NFT on mainnet only", async () => {
    const has = ctx({ client: { readContract: async () => BigInt(1), getCode: async () => undefined } });
    expect((await basenameTask.verify({}, has)).status).toBe("passed");
    expect((await basenameTask.verify({}, ctx())).status).toBe("failed");
    expect((await basenameTask.verify({}, { ...has, chainId: 84532 })).status).toBe("unavailable");
  });

  it("wallet age from the first transaction", async () => {
    const cfg = walletAgeTask.configSchema.parse({ minDays: 30 });
    const now = 1_700_100_000;
    const old = ctx({ now, fetch: (async () => json({ status: "1", result: [{ timeStamp: String(now - 40 * 86_400) }] })) as typeof fetch });
    expect((await walletAgeTask.verify(cfg, old)).status).toBe("passed");
    const fresh = ctx({ now, fetch: (async () => json({ status: "1", result: [{ timeStamp: String(now - 3 * 86_400) }] })) as typeof fetch });
    expect((await walletAgeTask.verify(cfg, fresh)).status).toBe("failed");
  });
});

// ───────────────────────────── service ─────────────────────────────

describe("drop service: reviews, streaks, random amounts, raffles", () => {
  const signer = privateKeyToAccount(SIGNER_KEY);
  let prev: string | undefined;
  beforeEach(() => {
    prev = process.env.DROPS_TICKET_SIGNER_KEY;
    process.env.DROPS_TICKET_SIGNER_KEY = SIGNER_KEY;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.DROPS_TICKET_SIGNER_KEY;
    else process.env.DROPS_TICKET_SIGNER_KEY = prev;
  });

  function deps(state: { now: number; claims?: Record<string, { claims: number; last: number }>; max?: bigint }) {
    const drop = {
      creator: CREATOR,
      token: DROPS,
      amountPerClaim: BigInt(1000),
      maxAmountPerClaim: state.max ?? BigInt(5000),
      budget: BigInt(1_000_000),
      createdAt: 1_700_000_000,
      unlockAt: 0,
      expiresAt: 1_800_000_000,
      ticketSigner: signer.address,
      allowlistRoot: h32("00"),
      committed: false,
      paused: false,
      closed: false,
    };
    const client = {
      readContract: async ({ functionName, args }: { functionName: string; args?: readonly unknown[] }) => {
        if (functionName === "getDrop") return [drop, "", ""];
        if (functionName === "walletState") {
          const w = state.claims?.[String(args?.[1]).toLowerCase()];
          return [w?.claims ?? 0, BigInt(w?.last ?? 0)];
        }
        if (functionName === "claimBlocker") return "";
        throw new Error(functionName);
      },
      getCode: async () => undefined,
      getBlock: async () => ({ hash: h32("77"), number: BigInt(123) }),
    };
    const d: DropDeps = {
      contract: DROPS,
      client: client as unknown as DropDeps["client"],
      kv: createMemoryKv(),
      fetch: (async () => json({})) as typeof fetch,
      env: {},
      now: () => state.now,
    };
    return d;
  }

  it("creator approval passes a review task for that wallet", async () => {
    const d = deps({ now: 1_700_100_000 });
    await saveDefinition(d, DROP_ID, CREATOR, { version: 1, tasks: [{ id: "meme", type: "review", config: { instructions: "Post a meme" } }] });
    const sub = await checkTask(d, DROP_ID, ALICE, "meme", { content: "https://x.com/alice/status/1" });
    expect(sub.status).toBe("pending");
    await expect(issueTicket(d, DROP_ID, ALICE)).rejects.toMatchObject({ status: 403 });
    await expect(decideReview(d, DROP_ID, ALICE, { wallet: ALICE, taskId: "meme", approve: true })).rejects.toMatchObject({ status: 403 });
    await decideReview(d, DROP_ID, CREATOR, { wallet: ALICE, taskId: "meme", approve: true });
    const t = await issueTicket(d, DROP_ID, ALICE);
    expect(t.amount).toBe("1000");
  });

  it("streak bonus grows on consecutive claims; rejects rewards above the onchain cap", async () => {
    const state: { now: number; claims: Record<string, { claims: number; last: number }> } = { now: 1_700_100_000, claims: {} };
    const d = deps(state);
    const def = {
      version: 1,
      tasks: [{ id: "w", type: "secret_word", config: { answers: ["gm"] }, repeat: true }],
      rewards: { mode: "fixed", streak: { bonusBps: 1000, maxDays: 3, windowHours: 48 } },
    };
    await saveDefinition(d, DROP_ID, CREATOR, def);
    await checkTask(d, DROP_ID, ALICE, "w", { answer: "gm" });
    expect((await issueTicket(d, DROP_ID, ALICE)).amount).toBe("1000");
    // Claimed; a day later, second claim continues the streak (+10%).
    state.claims[ALICE] = { claims: 1, last: state.now };
    state.now += 86_400;
    await checkTask(d, DROP_ID, ALICE, "w", { answer: "gm" });
    const t2 = await issueTicket(d, DROP_ID, ALICE);
    expect(t2.amount).toBe("1100");
    const inner = ticketInnerHash({ chainId: 8453, contract: DROPS, dropId: DROP_ID, claimer: ALICE, claimIndex: 1, amount: BigInt(1100), deadline: BigInt(t2.deadline) });
    expect(await recoverMessageAddress({ message: { raw: inner }, signature: t2.ticket })).toBe(signer.address);

    const capped = deps({ now: 1_700_100_000, max: BigInt(1050) });
    await expect(saveDefinition(capped, DROP_ID, CREATOR, def)).rejects.toThrow("exceed");
  });

  it("random amounts land in range", async () => {
    const d = deps({ now: 1_700_100_000 });
    await saveDefinition(d, DROP_ID, CREATOR, {
      version: 1,
      tasks: [{ id: "w", type: "secret_word", config: { answers: ["gm"] } }],
      rewards: { mode: "random", min: "500", max: "4000" },
    });
    await checkTask(d, DROP_ID, ALICE, "w", { answer: "gm" });
    const a = BigInt((await issueTicket(d, DROP_ID, ALICE)).amount);
    expect(a >= BigInt(500) && a <= BigInt(4000)).toBe(true);
  });

  it("raffle: only eligible wallets enter, the draw is final, and only winners get tickets", async () => {
    const state = { now: 1_700_100_000 };
    const d = deps(state);
    const saved = await saveDefinition(d, DROP_ID, CREATOR, {
      version: 1,
      tasks: [{ id: "w", type: "secret_word", config: { answers: ["gm"] } }],
      raffle: { winners: 1, drawAt: state.now + 3600 },
    });
    expect(saved.raffle?.commit).toMatch(/^0x[0-9a-f]{64}$/);

    await expect(enterRaffle(d, DROP_ID, ALICE)).rejects.toMatchObject({ status: 403 });
    for (const w of [ALICE, BOB]) {
      await checkTask(d, DROP_ID, w, "w", { answer: "gm" });
      await enterRaffle(d, DROP_ID, w);
    }
    await expect(issueTicket(d, DROP_ID, ALICE)).rejects.toThrow("hasn't been drawn");
    await expect(drawRaffle(d, DROP_ID)).rejects.toMatchObject({ status: 409 });

    state.now += 3601;
    await expect(enterRaffle(d, DROP_ID, CAROL)).rejects.toMatchObject({ status: 409 });
    const r1 = await drawRaffle(d, DROP_ID);
    const r2 = await drawRaffle(d, DROP_ID);
    expect(r2).toEqual(r1);
    expect(r1.winners).toHaveLength(1);
    expect(raffleCommit(r1.seed)).toBe(saved.raffle?.commit);
    expect(drawWinners([ALICE, BOB], 1, r1.seed, r1.blockHash)).toEqual(r1.winners);

    const winner = r1.winners[0] as `0x${string}`;
    const loser = winner === ALICE ? BOB : ALICE;
    expect((await issueTicket(d, DROP_ID, winner)).amount).toBe("1000");
    await expect(issueTicket(d, DROP_ID, loser)).rejects.toThrow("wasn't drawn");
    expect((await raffleStatus(d, DROP_ID, winner)).result?.won).toBe(true);
  });
});
