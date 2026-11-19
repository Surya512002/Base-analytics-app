import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import type { TaskKv } from "./types";
import { DropError, checkTask, confirmClaim, feed, getProgress, getPublicDefinition, issueTicket, saveDefinition, saveListing, updateTasks, type DropDeps } from "./service";
import { POOL_RESERVE_SEC } from "./split-pool";
import { signLink } from "./client";

const CREATOR = "0x00000000000000000000000000000000c0ffee00" as const;
const DROPS = "0x1111111111111111111111111111111111111111" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;
const ZERO32 = `0x${"0".repeat(64)}` as const;
const DROP_ID = BigInt(2_000_000_001);
const SIGNER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const signer = privateKeyToAccount(SIGNER_KEY);
const wallet = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`;
const ETH = (s: string) => BigInt(Math.round(Number(s) * 1e6)) * BigInt(10) ** BigInt(12);
const T0 = 1_700_000_000;

/** In-memory KV with a controllable clock so reservations can expire. */
function clockKv(clock: { now: number }): TaskKv {
  const m = new Map<string, { v: string; exp: number | null }>();
  const live = (k: string) => {
    const e = m.get(k);
    if (!e) return null;
    if (e.exp !== null && clock.now >= e.exp) {
      m.delete(k);
      return null;
    }
    return e;
  };
  return {
    async get(k) {
      return live(k)?.v ?? null;
    },
    async set(k, v, ttl) {
      m.set(k, { v, exp: ttl ? clock.now + ttl : null });
    },
    async setIfAbsent(k, v, ttl) {
      if (live(k)) return false;
      m.set(k, { v, exp: ttl ? clock.now + ttl : null });
      return true;
    },
    async incr(k) {
      const n = Number(live(k)?.v ?? "0") + 1;
      m.set(k, { v: String(n), exp: null });
      return n;
    },
  };
}

interface World {
  d: DropDeps;
  clock: { now: number };
  claims: Map<string, number>;
  drop: Record<string, unknown>;
  /** Pretend the wallet's claim landed onchain. */
  claim(w: string, amount: bigint): void;
}

function world(over: Partial<Record<string, unknown>> = {}, extraDrops: Array<Record<string, unknown>> = []): World {
  const clock = { now: T0 + 100 };
  const claims = new Map<string, number>();
  const drop: Record<string, unknown> = {
    creator: CREATOR,
    token: ZERO,
    amountPerClaim: ETH("0.001"),
    maxAmountPerClaim: ETH("0.02"),
    budget: ETH("1"),
    maxClaimsTotal: 100,
    claimedCount: 0,
    maxClaimsPerWallet: 1,
    cooldown: 0,
    createdAt: T0,
    unlockAt: 0,
    expiresAt: T0 + 90 * 86_400,
    linkSigner: ZERO,
    ticketSigner: signer.address,
    gate: ZERO,
    allowlistRoot: ZERO32,
    codesRoot: ZERO32,
    committed: false,
    paused: false,
    closed: false,
    ...over,
  };
  const all = new Map<string, Record<string, unknown>>([[DROP_ID.toString(), drop]]);
  extraDrops.forEach((x, i) => all.set((DROP_ID + BigInt(i + 1)).toString(), { ...drop, ...x }));
  const client = {
    readContract: async ({ functionName, args }: { functionName: string; args: unknown[] }) => {
      if (functionName === "getDrop") {
        const x = all.get(String(args[0]));
        if (!x) return [{ ...drop, creator: ZERO }, "", ""];
        return [x, "", ""];
      }
      if (functionName === "nextDropId") return DROP_ID + BigInt(all.size);
      if (functionName === "walletState") return [claims.get(String(args[1]).toLowerCase()) ?? 0, 0];
      if (functionName === "claimBlocker") return "";
      throw new Error(functionName);
    },
    getCode: async () => undefined,
  };
  const w: World = {
    clock,
    claims,
    drop,
    claim(who, amount) {
      claims.set(who.toLowerCase(), (claims.get(who.toLowerCase()) ?? 0) + 1);
      drop.budget = (drop.budget as bigint) - amount;
      drop.claimedCount = (drop.claimedCount as number) + 1;
    },
    d: {
      contract: DROPS,
      client: client as unknown as DropDeps["client"],
      kv: clockKv(clock),
      fetch: (async () => new Response("{}")) as typeof fetch,
      env: {},
      now: () => clock.now,
    },
  };
  return w;
}

const splitDef = { version: 1, tasks: [], rewards: { mode: "split", min: ETH("0.001").toString(), max: ETH("0.02").toString() } };

describe("random split drops (1 ETH over 100 cards)", () => {
  let prev: string | undefined;
  beforeEach(() => {
    prev = process.env.DROPS_TICKET_SIGNER_KEY;
    process.env.DROPS_TICKET_SIGNER_KEY = SIGNER_KEY;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.DROPS_TICKET_SIGNER_KEY;
    else process.env.DROPS_TICKET_SIGNER_KEY = prev;
  });

  it("hands out 100 shares that are random, in range, and add up to exactly 1 ETH", async () => {
    const w = world();
    await saveDefinition(w.d, DROP_ID, CREATOR, splitDef);
    const amounts: bigint[] = [];
    for (let i = 1; i <= 100; i++) {
      const t = await issueTicket(w.d, DROP_ID, wallet(i));
      const a = BigInt(t.amount);
      expect(a >= ETH("0.001") && a <= ETH("0.02")).toBe(true);
      amounts.push(a);
      w.claim(wallet(i), a);
    }
    expect(amounts.reduce((x, y) => x + y, BigInt(0))).toBe(ETH("1"));
    expect(w.drop.budget).toBe(BigInt(0)); // nothing left over, nothing overdrawn
    expect(new Set(amounts.map(String)).size).toBeGreaterThan(50);
  });

  it("asking twice gives the same share (no re-rolling), but a new signed ticket", async () => {
    const w = world();
    await saveDefinition(w.d, DROP_ID, CREATOR, splitDef);
    const a = await issueTicket(w.d, DROP_ID, wallet(1));
    w.clock.now += 5;
    const b = await issueTicket(w.d, DROP_ID, wallet(1));
    expect(b.amount).toBe(a.amount);
    expect(b.deadline).toBeGreaterThan(a.deadline);
  });

  it("two wallets never hold the same share; the 101st asker is told to wait", async () => {
    const w = world();
    await saveDefinition(w.d, DROP_ID, CREATOR, splitDef);
    const got: string[] = [];
    for (let i = 1; i <= 100; i++) got.push((await issueTicket(w.d, DROP_ID, wallet(i))).amount);
    await expect(issueTicket(w.d, DROP_ID, wallet(101))).rejects.toMatchObject({ status: 409 });
    // total reserved = whole budget, so every share was given out once
    expect(got.reduce((x, y) => x + BigInt(y), BigInt(0))).toBe(ETH("1"));
  });

  it("an abandoned reservation goes back to the pool; a claimed one never does", async () => {
    const w = world({ maxClaimsTotal: 2, budget: ETH("0.03"), maxAmountPerClaim: ETH("0.02") });
    await saveDefinition(w.d, DROP_ID, CREATOR, { ...splitDef, rewards: { mode: "split", min: ETH("0.005").toString(), max: ETH("0.02").toString() } });
    const a = await issueTicket(w.d, DROP_ID, wallet(1)); // will claim
    const b = await issueTicket(w.d, DROP_ID, wallet(2)); // abandons
    await expect(issueTicket(w.d, DROP_ID, wallet(3))).rejects.toMatchObject({ status: 409 });

    w.claim(wallet(1), BigInt(a.amount));
    await confirmClaim(w.d, DROP_ID, wallet(1)); // share made permanent

    w.clock.now += POOL_RESERVE_SEC + 1; // wallet 2's reservation lapses
    const c = await issueTicket(w.d, DROP_ID, wallet(3));
    expect(c.amount).toBe(b.amount); // wallet 3 gets the abandoned share, not the claimed one
    await expect(issueTicket(w.d, DROP_ID, wallet(4))).rejects.toMatchObject({ status: 409 });
    expect(BigInt(a.amount) + BigInt(c.amount)).toBe(ETH("0.03"));
  });

  it("settles a claimed share when the claimer's progress is read (no confirm call needed)", async () => {
    const w = world({ maxClaimsTotal: 2, budget: ETH("0.03") });
    await saveDefinition(w.d, DROP_ID, CREATOR, { ...splitDef, rewards: { mode: "split", min: ETH("0.005").toString(), max: ETH("0.02").toString() } });
    const a = await issueTicket(w.d, DROP_ID, wallet(1));
    w.claim(wallet(1), BigInt(a.amount));
    await getProgress(w.d, DROP_ID, wallet(1));
    w.clock.now += POOL_RESERVE_SEC + 1;
    await issueTicket(w.d, DROP_ID, wallet(2));
    const third = await issueTicket(w.d, DROP_ID, wallet(3)).catch((e) => e);
    expect(third).toBeInstanceOf(DropError); // wallet 1's share was not reissued
  });

  it("rejects splits that can't work and a changed split once someone has claimed", async () => {
    await expect(saveDefinition(world({ budget: ETH("0.05") }).d, DROP_ID, CREATOR, splitDef)).rejects.toThrow(/too small/);
    await expect(saveDefinition(world({ budget: ETH("5") }).d, DROP_ID, CREATOR, splitDef)).rejects.toThrow(/too big/);
    await expect(saveDefinition(world({ maxClaimsTotal: 0 }).d, DROP_ID, CREATOR, splitDef)).rejects.toThrow(/fixed number of claims/);
    await expect(
      saveDefinition(world({ maxAmountPerClaim: ETH("0.01") }).d, DROP_ID, CREATOR, splitDef)
    ).rejects.toThrow(/above the drop's max/);
    const w = world();
    await saveDefinition(w.d, DROP_ID, CREATOR, splitDef);
    w.claim(wallet(1), ETH("0.01"));
    // re-saving with different numbers after a claim keeps the original pool
    await saveDefinition(w.d, DROP_ID, CREATOR, { ...splitDef, rewards: { mode: "split", min: ETH("0.002").toString(), max: ETH("0.02").toString() } });
    const t = await issueTicket(w.d, DROP_ID, wallet(2));
    expect(BigInt(t.amount) >= ETH("0.001")).toBe(true);
  });

  it("a link-protected split only reserves a share for someone holding the link", async () => {
    const linkKey = generatePrivateKey();
    const linkSigner = privateKeyToAccount(linkKey).address;
    const w = world({ linkSigner });
    await saveDefinition(w.d, DROP_ID, CREATOR, splitDef);
    await expect(issueTicket(w.d, DROP_ID, wallet(1))).rejects.toMatchObject({ status: 403 });
    const wrong = await signLink(generatePrivateKey(), DROPS, DROP_ID, wallet(1));
    await expect(issueTicket(w.d, DROP_ID, wallet(1), { linkSig: wrong })).rejects.toMatchObject({ status: 403 });
    const forOther = await signLink(linkKey, DROPS, DROP_ID, wallet(2));
    await expect(issueTicket(w.d, DROP_ID, wallet(1), { linkSig: forOther })).rejects.toMatchObject({ status: 403 });
    const good = await signLink(linkKey, DROPS, DROP_ID, wallet(1));
    const t = await issueTicket(w.d, DROP_ID, wallet(1), { linkSig: good });
    expect(BigInt(t.amount) >= ETH("0.001")).toBe(true);
  });
});

describe("daily quests: different tasks each day", () => {
  let prev: string | undefined;
  beforeEach(() => {
    prev = process.env.DROPS_TICKET_SIGNER_KEY;
    process.env.DROPS_TICKET_SIGNER_KEY = SIGNER_KEY;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.DROPS_TICKET_SIGNER_KEY;
    else process.env.DROPS_TICKET_SIGNER_KEY = prev;
  });

  const word = (id: string, answer: string, days?: { from: number; to: number }) => ({ id, type: "secret_word", days, config: { answers: [answer] } });
  const daily = { cooldown: 86_400, maxClaimsPerWallet: 0, maxClaimsTotal: 0, amountPerClaim: ETH("0.001"), maxAmountPerClaim: ETH("0.001") };

  it("only today's tasks count, and checking tomorrow's task today is refused", async () => {
    const w = world(daily);
    await saveDefinition(w.d, DROP_ID, CREATOR, { version: 1, tasks: [word("day1", "comment", { from: 1, to: 1 }), word("day2", "post", { from: 2, to: 2 })] });

    const pub = await getPublicDefinition(w.d, DROP_ID);
    expect(pub?.day).toBe(1);
    expect(pub?.tasks.map((t) => [t.id, t.activeNow])).toEqual([["day1", true], ["day2", false]]);

    await expect(checkTask(w.d, DROP_ID, wallet(1), "day2", { answer: "post" })).rejects.toMatchObject({ status: 409 });
    await checkTask(w.d, DROP_ID, wallet(1), "day1", { answer: "comment" });
    expect((await issueTicket(w.d, DROP_ID, wallet(1))).claimIndex).toBe(0);

    // tomorrow: day1's task no longer counts, day2's does
    w.clock.now += 86_400;
    w.claims.set(wallet(1), 1);
    expect((await getPublicDefinition(w.d, DROP_ID))?.tasks.map((t) => t.activeNow)).toEqual([false, true]);
    await expect(issueTicket(w.d, DROP_ID, wallet(1))).rejects.toMatchObject({ status: 403 });
    await checkTask(w.d, DROP_ID, wallet(1), "day2", { answer: "post" });
    expect((await issueTicket(w.d, DROP_ID, wallet(1))).claimIndex).toBe(1);
  });

  it("a day with no task scheduled can't be claimed", async () => {
    const w = world(daily);
    await saveDefinition(w.d, DROP_ID, CREATOR, { version: 1, tasks: [word("day1", "x", { from: 1, to: 1 })] });
    w.clock.now += 3 * 86_400;
    const p = await getProgress(w.d, DROP_ID, wallet(1));
    expect(p.noTaskToday).toBe(true);
    expect(p.evaluation.eligible).toBe(false);
    await expect(issueTicket(w.d, DROP_ID, wallet(1))).rejects.toThrow(/no task scheduled for today/);
  });

  it("tasks with no day window apply every day", async () => {
    const w = world(daily);
    await saveDefinition(w.d, DROP_ID, CREATOR, { version: 1, tasks: [word("always", "gm"), word("d2", "x", { from: 2, to: 2 })] });
    expect((await getPublicDefinition(w.d, DROP_ID))?.tasks.map((t) => t.activeNow)).toEqual([true, false]);
    w.clock.now += 86_400;
    expect((await getPublicDefinition(w.d, DROP_ID))?.tasks.map((t) => t.activeNow)).toEqual([true, true]);
  });

  it("the creator can add tomorrow's task later, without touching the rest", async () => {
    const w = world(daily);
    await saveDefinition(w.d, DROP_ID, CREATOR, { version: 1, tasks: [word("t1", "gm", { from: 1, to: 1 })] });
    const next = await updateTasks(w.d, DROP_ID, CREATOR, { add: [{ type: "secret_word", title: "Reply to the new post", days: { from: 2, to: 2 }, config: { answers: ["reply"] } }] });
    expect(next.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
    // answers are stored hashed, never as typed
    expect(JSON.stringify(next.tasks[1]!.config)).not.toContain("reply");
    w.clock.now += 86_400;
    await checkTask(w.d, DROP_ID, wallet(1), "t2", { answer: "Reply" });
    expect((await issueTicket(w.d, DROP_ID, wallet(1))).claimIndex).toBe(0);
    // removing yesterday's task
    const after = await updateTasks(w.d, DROP_ID, CREATOR, { remove: ["t1"] });
    expect(after.tasks.map((t) => t.id)).toEqual(["t2"]);
  });

  it("only the creator can change tasks, and a locked drop can't change", async () => {
    const w = world(daily);
    await saveDefinition(w.d, DROP_ID, CREATOR, { version: 1, tasks: [word("t1", "gm")] });
    await expect(updateTasks(w.d, DROP_ID, wallet(9), { add: [] })).rejects.toMatchObject({ status: 403 });
    const locked = world({ ...daily, committed: true });
    await saveDefinition(locked.d, DROP_ID, CREATOR, { version: 1, tasks: [word("t1", "gm")] });
    await expect(updateTasks(locked.d, DROP_ID, CREATOR, { add: [] })).rejects.toMatchObject({ status: 409 });
    await expect(updateTasks(w.d, DROP_ID, CREATOR, { add: [{ type: "nope", config: {} }] })).rejects.toThrow(/Unknown task type/);
    await expect(updateTasks(w.d, DROP_ID, CREATOR, { add: [{ type: "secret_word", days: { from: 3, to: 2 }, config: { answers: ["a"] } }] })).rejects.toThrow(/end before they start/);
  });
});

describe("public feed", () => {
  it("lists only what creators listed, newest first; link and gift-card drops can't be listed", async () => {
    const w = world({}, [{}, { linkSigner: wallet(77) }, {}]);
    const id = (n: number) => DROP_ID + BigInt(n);
    await saveListing(w.d, id(0), CREATOR, { title: "Old quest", blurb: "x", category: "quest" });
    await expect(saveListing(w.d, id(2), CREATOR, { title: "Secret", blurb: "", category: "gift" })).rejects.toThrow(/private by design/);
    await saveListing(w.d, id(3), CREATOR, { title: "New daily", blurb: "Every day", category: "daily" });
    await expect(saveListing(w.d, id(3), wallet(9), { title: "Hijack", category: "daily" })).rejects.toMatchObject({ status: 403 });
    await expect(saveListing(w.d, id(3), CREATOR, { title: "ab", category: "daily" })).rejects.toThrow(/title/);
    await expect(saveListing(w.d, id(3), CREATOR, { title: "Fine title", category: "nope" })).rejects.toThrow(/category/);

    const out = await feed(w.d, { limit: 10 });
    expect(out.items.map((i) => i.listing.title)).toEqual(["New daily", "Old quest"]);
    expect(out.items[0]).toMatchObject({ id: id(3).toString(), state: "live", gated: "holders" });

    // unlisting removes it
    w.clock.now += 60; // past the feed cache
    await saveListing(w.d, id(3), CREATOR, null);
    const after = await feed(w.d, { limit: 10 });
    expect(after.items.map((i) => i.listing.title)).toEqual(["Old quest"]);
  });
});
