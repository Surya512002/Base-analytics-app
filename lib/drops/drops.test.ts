import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recoverMessageAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createMemoryKv } from "./kv";
import { currentResults, evaluate, RESULT_TTL_SEC } from "./engine";
import { ticketInnerHash, TICKET_TAG } from "./chain";
import { tokenBalanceTask, contractReadTask } from "./tasks/onchain";
import { tokenBoughtTask, heldSinceTask } from "./tasks/trading";
import { farcasterFollowTask } from "./tasks/farcaster";
import { walletPostCode, xPostTask } from "./tasks/social-proof";
import { quizTask, secretWordTask } from "./tasks/answers";
import { DropError, checkTask, issueTicket, saveDefinition, type DropDeps } from "./service";
import type { DropDefinition, TaskContext } from "./types";

const ALICE = "0x00000000000000000000000000000000000a11ce" as const;
const BOB = "0x0000000000000000000000000000000000000b0b" as const;
const CREATOR = "0x00000000000000000000000000000000c0ffee00" as const;
const DROPS = "0x1111111111111111111111111111111111111111" as const;
const TOKEN = "0x2222222222222222222222222222222222222222" as const;
const POOL = "0x3333333333333333333333333333333333333333" as const;
const FRIEND = "0x4444444444444444444444444444444444444444" as const;
const DROP_ID = BigInt(2_000_000_001);
const SIGNER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

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
    fetch: (async () => new Response("{}")) as typeof fetch,
    env: { neynarKey: "k", explorerKey: "k" },
    kv: createMemoryKv(),
    ...over,
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// ───────────────────────────── ticket digest ─────────────────────────────

describe("ticket digest", () => {
  it("matches the contract's abi.encode (reference computed with `cast`)", () => {
    expect(TICKET_TAG).toBe("0x7e65f7cda80b310b68d9556b527e1e6298eeffaba8fb3ac1171db55484673639");
    const inner = ticketInnerHash({
      chainId: 8453,
      contract: DROPS,
      dropId: DROP_ID,
      claimer: "0x2222222222222222222222222222222222222222",
      claimIndex: 3,
      amount: BigInt(1_000_000),
      deadline: BigInt(1_700_000_600),
    });
    expect(inner).toBe("0x45e8ca94ebc4de05d3755066ba32aff42355df663965901c4bc386e488018c71");
  });
});

// ───────────────────────────── engine ─────────────────────────────

describe("rules engine", () => {
  const def: DropDefinition = {
    version: 1,
    tasks: [
      { id: "hold", type: "token_balance", required: true, points: 0, repeat: false, config: {} },
      { id: "fc", type: "farcaster_follow", required: true, points: 10, group: "social", repeat: false, config: {} },
      { id: "x", type: "x_post", required: true, points: 10, group: "social", repeat: false, config: {} },
      { id: "quiz", type: "quiz", required: false, points: 50, repeat: false, config: {} },
      { id: "daily", type: "secret_word", required: false, points: 5, repeat: true, config: {} },
    ],
    minPoints: 10,
    tiers: [
      { minPoints: 0, amount: "0" },
      { minPoints: 60, amount: "3000" },
    ],
  };
  const pass = { status: "passed" };

  it("needs every required task, one of each group, and the points", () => {
    expect(evaluate(def, {}).missing).toEqual(["hold", "group:social", "points:10"]);
    const ev = evaluate(def, { hold: pass, x: pass });
    expect(ev).toMatchObject({ eligible: true, points: 10, amount: "0" });
  });

  it("pays the highest tier reached", () => {
    expect(evaluate(def, { hold: pass, fc: pass, quiz: pass }).amount).toBe("3000");
  });

  it("repeat tasks reset after each claim, and stale results expire", () => {
    const now = 2_000_000;
    const progress = {
      results: {
        daily: { status: "passed" as const, message: "", at: now, claimIndex: 0 },
        hold: { status: "passed" as const, message: "", at: now - RESULT_TTL_SEC - 1, claimIndex: 0 },
        x: { status: "passed" as const, message: "", at: now, claimIndex: 0 },
      },
    };
    const forNextClaim = currentResults(def, progress, 1, now);
    expect(Object.keys(forNextClaim)).toEqual(["x"]);
    expect(Object.keys(currentResults(def, progress, 0, now)).sort()).toEqual(["daily", "x"]);
  });
});

// ───────────────────────────── onchain tasks ─────────────────────────────

describe("onchain tasks", () => {
  it("token_balance compares the live balance", async () => {
    const c = ctx({ client: { readContract: async () => BigInt(150), getCode: async () => undefined } });
    const cfg = tokenBalanceTask.configSchema.parse({ token: TOKEN, minAmount: "100" });
    expect((await tokenBalanceTask.verify(cfg, c)).status).toBe("passed");
    const cfg2 = tokenBalanceTask.configSchema.parse({ token: TOKEN, minAmount: "200" });
    expect((await tokenBalanceTask.verify(cfg2, c)).status).toBe("failed");
  });

  it("contract_read only accepts one-address view functions and compares the result", async () => {
    expect(contractReadTask.configSchema.safeParse({ contract: TOKEN, signature: "function burn(address)", compare: ">", value: "0" }).success).toBe(false);
    const cfg = contractReadTask.configSchema.parse({
      contract: TOKEN,
      signature: "function stakedOf(address) view returns (uint256)",
      compare: ">=",
      value: "5",
    });
    const c = ctx({ client: { readContract: async () => BigInt(5), getCode: async () => undefined } });
    expect((await contractReadTask.verify(cfg, c)).status).toBe("passed");
  });

  it("an RPC failure is 'unavailable', never a pass", async () => {
    const c = ctx({ client: { readContract: async () => Promise.reject(new Error("rpc")), getCode: async () => undefined } });
    const cfg = tokenBalanceTask.configSchema.parse({ token: TOKEN, minAmount: "1" });
    expect((await tokenBalanceTask.verify(cfg, c)).status).toBe("unavailable");
  });
});

// ───────────────────────────── trading tasks ─────────────────────────────

describe("trading tasks", () => {
  const transfers = (rows: Array<[string, string, string, number]>) =>
    json({ status: "1", message: "OK", result: rows.map(([from, to, value, ts], i) => ({ hash: `0x${i}`, from, to, value, timeStamp: String(ts) })) });
  const codeAt = (contracts: string[]) => async ({ address }: { address: string }) =>
    (contracts.includes(address.toLowerCase()) ? "0x60" : undefined) as `0x${string}` | undefined;

  it("counts buys from pools, not gifts from wallets, and subtracts sells", async () => {
    const c = ctx({
      fetch: (async () =>
        transfers([
          [POOL, ALICE, "100", 1_700_000_100], // buy
          [FRIEND, ALICE, "500", 1_700_000_200], // gift from a plain wallet: ignored
          [ALICE, POOL, "30", 1_700_000_300], // sell
        ])) as typeof fetch,
      client: { readContract: async () => BigInt(1000), getCode: codeAt([POOL.toLowerCase()]) },
    });
    const cfg = tokenBoughtTask.configSchema.parse({ token: TOKEN, minAmount: "70" });
    const ok = await tokenBoughtTask.verify(cfg, c);
    expect(ok).toMatchObject({ status: "passed", evidence: { netBought: "70", buys: 1 } });
    const cfg2 = tokenBoughtTask.configSchema.parse({ token: TOKEN, minAmount: "71" });
    expect((await tokenBoughtTask.verify(cfg2, c)).status).toBe("failed");
  });

  it("requires still holding at claim time (no buy → claim → dump)", async () => {
    const c = ctx({
      fetch: (async () => transfers([[POOL, ALICE, "100", 1_700_000_100]])) as typeof fetch,
      client: { readContract: async () => BigInt(10), getCode: codeAt([POOL.toLowerCase()]) },
    });
    const cfg = tokenBoughtTask.configSchema.parse({ token: TOKEN, minAmount: "100" });
    expect((await tokenBoughtTask.verify(cfg, c)).status).toBe("failed");
  });

  it("is unavailable without an explorer key", async () => {
    const cfg = tokenBoughtTask.configSchema.parse({ token: TOKEN, minAmount: "1" });
    expect((await tokenBoughtTask.verify(cfg, ctx({ env: {} }))).status).toBe("unavailable");
  });

  it("held_since fails if anything left the wallet in the window", async () => {
    const base = { client: { readContract: async () => BigInt(500), getCode: async () => undefined } };
    const cfg = heldSinceTask.configSchema.parse({ token: TOKEN, minAmount: "400", days: 7 });
    const held = ctx({ ...base, fetch: (async () => transfers([[POOL, ALICE, "50", 1_700_090_000]])) as typeof fetch });
    expect((await heldSinceTask.verify(cfg, held)).status).toBe("passed");
    const sold = ctx({ ...base, fetch: (async () => transfers([[ALICE, POOL, "1", 1_700_090_000]])) as typeof fetch });
    expect((await heldSinceTask.verify(cfg, sold)).status).toBe("failed");
  });
});

// ───────────────────────────── social tasks ─────────────────────────────

describe("farcaster tasks", () => {
  const neynar = (following: boolean) =>
    (async (url: URL | string) => {
      const u = String(url);
      if (u.includes("bulk-by-address")) return json({ [ALICE]: [{ fid: 42, username: "alice" }], [BOB]: [{ fid: 42, username: "alice" }] });
      return json({ users: [{ viewer_context: { following } }] });
    }) as typeof fetch;

  it("checks the follow and binds one Farcaster account to one wallet per drop", async () => {
    const kv = createMemoryKv();
    const cfg = farcasterFollowTask.configSchema.parse({ targetFid: 7 });
    expect((await farcasterFollowTask.verify(cfg, ctx({ kv, fetch: neynar(false) }))).status).toBe("failed");
    expect((await farcasterFollowTask.verify(cfg, ctx({ kv, fetch: neynar(true) }))).status).toBe("passed");
    // Bob's wallet resolves to the same FID: refused.
    const bob = await farcasterFollowTask.verify(cfg, ctx({ kv, fetch: neynar(true), claimer: BOB }));
    expect(bob).toMatchObject({ status: "failed" });
    expect(bob.message).toContain("already used");
  });
});

describe("x_post task", () => {
  const code = walletPostCode(DROP_ID, ALICE, "t1");
  const oembed = (author: string, text: string) =>
    (async () => json({ author_url: `https://twitter.com/${author}`, html: `<blockquote><p>${text}</p>&mdash; Someone (@basebuilders) <a>Nov 18</a></blockquote>` })) as typeof fetch;
  const cfg = xPostTask.configSchema.parse({ mention: "@basebuilders", mustInclude: "#BaseDrops" });
  const sub = { url: "https://x.com/alice/status/1234567890123" };

  it("passes when the post has the wallet's code, the mention and the text", async () => {
    const r = await xPostTask.verify(cfg, ctx({ submission: sub, fetch: oembed("alice", `gm @basebuilders #BaseDrops ${code}`) }));
    expect(r.status).toBe("passed");
  });

  it("the attribution line can't satisfy the mention, and the code must be this wallet's", async () => {
    expect((await xPostTask.verify(cfg, ctx({ submission: sub, fetch: oembed("alice", `#BaseDrops ${code}`) }))).status).toBe("failed");
    expect((await xPostTask.verify(cfg, ctx({ submission: sub, fetch: oembed("alice", "@basebuilders #BaseDrops drop-000000") }))).status).toBe("failed");
  });

  it("rejects non-post links and binds one X account per wallet", async () => {
    expect((await xPostTask.verify(cfg, ctx({ submission: { url: "https://evil.com/x" } }))).status).toBe("failed");
    const kv = createMemoryKv();
    await xPostTask.verify(cfg, ctx({ kv, submission: sub, fetch: oembed("alice", `@basebuilders #BaseDrops ${code}`) }));
    const bobCode = walletPostCode(DROP_ID, BOB, "t1");
    const r = await xPostTask.verify(cfg, ctx({ kv, claimer: BOB, submission: sub, fetch: oembed("alice", `@basebuilders #BaseDrops ${bobCode}`) }));
    expect(r.message).toContain("already used");
  });
});

// ───────────────────────────── answers ─────────────────────────────

describe("quiz and secret word", () => {
  it("stores only hashes, grades loosely, and limits attempts", async () => {
    const cfg = quizTask.prepare!(
      { questions: [{ question: "Chain?", answers: ["Base"] }, { question: "L?", answers: ["2", "two"] }], maxAttempts: 2 },
      { dropKey: "k", taskId: "q" }
    );
    expect(JSON.stringify(cfg)).not.toMatch(/"Base"|"two"/);
    expect(quizTask.publicConfig!(cfg)).toEqual({ questions: ["Chain?", "L?"], passMark: 2, maxAttempts: 2 });
    const kv = createMemoryKv();
    expect((await quizTask.verify(cfg, ctx({ kv, submission: { answers: ["base", "three"] } }))).status).toBe("failed");
    expect((await quizTask.verify(cfg, ctx({ kv, submission: { answers: [" BASE!", "Two"] } }))).status).toBe("passed");
    const third = await quizTask.verify(cfg, ctx({ kv, submission: { answers: ["base", "2"] } }));
    expect(third.message).toContain("No attempts left");
  });

  it("re-saving a prepared config keeps the same hashes", () => {
    const cfg = secretWordTask.prepare!({ answers: ["onchain summer"] }, { dropKey: "k", taskId: "s" });
    expect(secretWordTask.prepare!(cfg, { dropKey: "k", taskId: "s" })).toEqual(cfg);
  });
});

// ───────────────────────────── service ─────────────────────────────

describe("drop service", () => {
  const signer = privateKeyToAccount(SIGNER_KEY);
  let prevKey: string | undefined;
  beforeEach(() => {
    prevKey = process.env.DROPS_TICKET_SIGNER_KEY;
    process.env.DROPS_TICKET_SIGNER_KEY = SIGNER_KEY;
  });
  afterEach(() => {
    if (prevKey === undefined) delete process.env.DROPS_TICKET_SIGNER_KEY;
    else process.env.DROPS_TICKET_SIGNER_KEY = prevKey;
  });

  function deps(over: { ticketSigner?: string; committed?: boolean; blocker?: string; claims?: number; balance?: bigint } = {}) {
    const drop = {
      creator: CREATOR,
      token: TOKEN,
      amountPerClaim: BigInt(1000),
      maxAmountPerClaim: BigInt(5000),
      budget: BigInt(100_000),
      createdAt: 1_700_000_000,
      unlockAt: 0,
      expiresAt: 1_800_000_000,
      ticketSigner: over.ticketSigner ?? signer.address,
      committed: over.committed ?? false,
      paused: false,
      closed: false,
    };
    const client = {
      readContract: async ({ functionName }: { functionName: string }) => {
        if (functionName === "getDrop") return [drop, "", ""];
        if (functionName === "walletState") return [over.claims ?? 0, 0];
        if (functionName === "claimBlocker") return over.blocker ?? "";
        if (functionName === "balanceOf") return over.balance ?? BigInt(100);
        throw new Error(functionName);
      },
      getCode: async () => undefined,
    };
    const d: DropDeps = {
      contract: DROPS,
      client: client as unknown as DropDeps["client"],
      kv: createMemoryKv(),
      fetch: (async () => json({})) as typeof fetch,
      env: {},
      now: () => 1_700_100_000,
    };
    return d;
  }

  const def = {
    version: 1,
    tasks: [
      { id: "hold", type: "token_balance", config: { token: TOKEN, minAmount: "50" } },
      { id: "word", type: "secret_word", required: false, points: 10, config: { answers: ["gm"] } },
    ],
    tiers: [{ minPoints: 10, amount: "2000" }],
  };

  it("only the onchain creator can save tasks, only for drops signed by this app", async () => {
    await expect(saveDefinition(deps(), DROP_ID, ALICE, def)).rejects.toMatchObject({ status: 403 });
    await expect(saveDefinition(deps({ ticketSigner: BOB }), DROP_ID, CREATOR, def)).rejects.toMatchObject({ status: 400 });
    await expect(
      saveDefinition(deps(), DROP_ID, CREATOR, { ...def, tiers: [{ minPoints: 0, amount: "999999" }] })
    ).rejects.toThrow("above the drop's max");
    await expect(saveDefinition(deps(), DROP_ID, CREATOR, { ...def, tasks: [{ id: "x", type: "nope", config: {} }] })).rejects.toThrow("Unknown task type");
  });

  it("a committed drop's tasks can't be changed once saved", async () => {
    const d = deps({ committed: true });
    await saveDefinition(d, DROP_ID, CREATOR, def);
    await expect(saveDefinition(d, DROP_ID, CREATOR, def)).rejects.toMatchObject({ status: 409 });
  });

  it("signs a ticket for the wallet's next claim with the tier amount, after re-checking", async () => {
    const d = deps({ claims: 2 });
    await saveDefinition(d, DROP_ID, CREATOR, def);
    await expect(issueTicket(d, DROP_ID, ALICE)).rejects.toMatchObject({ status: 403 });

    await checkTask(d, DROP_ID, ALICE, "hold");
    await checkTask(d, DROP_ID, ALICE, "word", { answer: "GM" });
    const t = await issueTicket(d, DROP_ID, ALICE);
    expect(t).toMatchObject({ claimIndex: 2, amount: "2000", deadline: 1_700_100_000 + 600 });
    const inner = ticketInnerHash({
      chainId: 8453,
      contract: DROPS,
      dropId: DROP_ID,
      claimer: ALICE,
      claimIndex: 2,
      amount: BigInt(2000),
      deadline: BigInt(t.deadline),
    });
    expect(await recoverMessageAddress({ message: { raw: inner }, signature: t.ticket })).toBe(signer.address);
  });

  it("re-checks balances at claim time and refuses when the contract says no", async () => {
    const d = deps();
    await saveDefinition(d, DROP_ID, CREATOR, def);
    await checkTask(d, DROP_ID, ALICE, "hold");
    // Balance dropped after the check.
    const sold = { ...d, client: { ...d.client, readContract: async (a: { functionName: string }) => (a.functionName === "balanceOf" ? BigInt(1) : d.client.readContract(a as never)) } } as DropDeps;
    await expect(issueTicket(sold, DROP_ID, ALICE)).rejects.toMatchObject({ status: 403 });

    const blocked = deps({ blocker: "Cooldown active" });
    blocked.kv = d.kv;
    await expect(issueTicket(blocked, DROP_ID, ALICE)).rejects.toThrow(new DropError("Cooldown active", 409));
  });
});
