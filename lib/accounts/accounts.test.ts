import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import { createMemoryKv } from "@/lib/drops/kv";
import { csrfViolation } from "@/lib/security/csrf";
import { consumeState, createState, getLinked, saveLink, safeReturnTo, unlink, LinkError } from "./store";
import { discordCreatedAt, discordMember, telegramMember, verifyTelegramLogin, xExchange } from "./providers";
import { discordMemberTask, telegramMemberTask, xAccountTask } from "@/lib/drops/tasks/accounts";
import { xPostTask, walletPostCode } from "@/lib/drops/tasks/social-proof";
import { isSealed } from "@/lib/voucher/secret-box";
import { loadDefinition, saveDefinition, type DropDeps } from "@/lib/drops/service";
import type { TaskContext } from "@/lib/drops/types";

const ALICE = "0x00000000000000000000000000000000000a11ce";
const BOB = "0x0000000000000000000000000000000000000b0b";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const NOW = 1_700_100_000;

function ctx(over: Partial<TaskContext> = {}): TaskContext {
  return {
    chainId: 8453,
    dropsContract: "0x1111111111111111111111111111111111111111",
    dropId: BigInt(2_000_000_001),
    dropCreatedAt: NOW - 1000,
    taskId: "t1",
    claimer: ALICE,
    now: NOW,
    client: { readContract: async () => BigInt(0), getCode: async () => undefined },
    fetch: (async () => json({})) as typeof fetch,
    env: {},
    kv: createMemoryKv(),
    ...over,
  };
}

// ───────────────────────────── CSRF ─────────────────────────────

describe("CSRF guard", () => {
  const base = { method: "POST", pathname: "/api/drops/1/reviews", hasSessionCookie: true, referer: null, secFetchSite: null, requestHost: "baseanalytics.app" };

  it("blocks cookie-authenticated writes from other sites", () => {
    expect(csrfViolation({ ...base, origin: "https://evil.example" })).toBeTruthy();
    expect(csrfViolation({ ...base, origin: null, secFetchSite: "cross-site" })).toBeTruthy();
    expect(csrfViolation({ ...base, origin: "null" })).toBeTruthy();
    expect(csrfViolation({ ...base, origin: null, referer: "https://evil.example/x" })).toBeTruthy();
  });

  it("allows our own origins, previews, reads, and requests without the cookie", () => {
    expect(csrfViolation({ ...base, origin: "https://baseanalytics.app" })).toBeNull();
    expect(csrfViolation({ ...base, origin: "https://base-analytics-app-git-x-surya512002s-projects.vercel.app" })).toBeNull();
    expect(csrfViolation({ ...base, origin: "http://localhost:3000", requestHost: "localhost:3000" })).toBeNull();
    expect(csrfViolation({ ...base, method: "GET", origin: "https://evil.example" })).toBeNull();
    expect(csrfViolation({ ...base, hasSessionCookie: false, origin: "https://evil.example" })).toBeNull();
    expect(csrfViolation({ ...base, pathname: "/drops", origin: "https://evil.example" })).toBeNull();
  });
});

// ───────────────────────────── store ─────────────────────────────

describe("linked account store", () => {
  const x = { provider: "x" as const, id: "123", username: "alice", verifiedType: "blue" };

  it("one platform account backs one wallet only", async () => {
    const kv = createMemoryKv();
    await saveLink(kv, ALICE, x, NOW);
    await expect(saveLink(kv, BOB, x, NOW)).rejects.toBeInstanceOf(LinkError);
    expect((await getLinked(kv, "x", ALICE))?.username).toBe("alice");
    expect(await getLinked(kv, "x", BOB)).toBeNull();
  });

  it("re-linking refreshes the snapshot but keeps the first link time", async () => {
    const kv = createMemoryKv();
    await saveLink(kv, ALICE, x, NOW);
    const again = await saveLink(kv, ALICE, { ...x, verifiedType: "none" }, NOW + 50);
    expect(again).toMatchObject({ linkedAt: NOW, snapshotAt: NOW + 50, verifiedType: "none" });
  });

  it("unlinking keeps the account reserved for this wallet (no rotating it between wallets)", async () => {
    const kv = createMemoryKv();
    await saveLink(kv, ALICE, x, NOW);
    await unlink(kv, ALICE, "x");
    expect(await getLinked(kv, "x", ALICE)).toBeNull();
    await expect(saveLink(kv, BOB, x, NOW)).rejects.toBeInstanceOf(LinkError);
    await expect(saveLink(kv, ALICE, x, NOW)).resolves.toBeTruthy();
  });

  it("OAuth state is single-use and return paths stay on this site", async () => {
    const kv = createMemoryKv();
    const s = await createState(kv, { wallet: ALICE, provider: "x", verifier: "v", returnTo: "/drops/1" });
    expect(await consumeState(kv, s)).toMatchObject({ wallet: ALICE });
    expect(await consumeState(kv, s)).toBeNull();
    expect(await consumeState(kv, "short")).toBeNull();
    expect(safeReturnTo("/drops/2000000001")).toBe("/drops/2000000001");
    for (const bad of ["https://evil.example", "//evil.example", "/drops#k=abc", "/x?y=1", 5]) expect(safeReturnTo(bad)).toBe("/drops");
  });
});

// ───────────────────────────── providers ─────────────────────────────

describe("platform adapters", () => {
  const TOKEN = "123456789:AAH-test-token-abcdefghijklmnopqrstuv";
  const signTg = (data: Record<string, string | number>) => {
    const dcs = Object.entries(data).map(([k, v]) => `${k}=${v}`).sort().join("\n");
    const hash = createHmac("sha256", createHash("sha256").update(TOKEN).digest()).update(dcs).digest("hex");
    return { ...data, hash };
  };

  it("verifies Telegram logins and rejects tampered or stale ones", () => {
    const good = signTg({ id: 4242, first_name: "Al", username: "al", auth_date: NOW - 60 });
    expect(verifyTelegramLogin(good, NOW, TOKEN)).toMatchObject({ provider: "telegram", id: "4242", username: "al" });
    expect(verifyTelegramLogin({ ...good, id: 9999 }, NOW, TOKEN)).toBeNull();
    expect(verifyTelegramLogin(signTg({ id: 4242, auth_date: NOW - 7200 }), NOW, TOKEN)).toBeNull();
    expect(verifyTelegramLogin(good, NOW, "999:other-token-abcdefghijklmnopqrstuvwxyz")).toBeNull();
  });

  it("X: reads the profile once and revokes the token", async () => {
    const prev = { id: process.env.X_CLIENT_ID, secret: process.env.X_CLIENT_SECRET };
    process.env.X_CLIENT_ID = "cid";
    process.env.X_CLIENT_SECRET = "csecret";
    const calls: string[] = [];
    const f = (async (url: string | URL) => {
      const u = String(url);
      calls.push(u);
      if (u.endsWith("/oauth2/token")) return json({ access_token: "tok" });
      if (u.includes("/users/me")) return json({ data: { id: "77", username: "bob", verified_type: "blue", created_at: "2020-01-01T00:00:00Z", public_metrics: { followers_count: 500 } } });
      return json({});
    }) as typeof fetch;
    try {
      const acct = await xExchange("code", "verifier", f);
      expect(acct).toMatchObject({ provider: "x", id: "77", username: "bob", verifiedType: "blue", followers: 500 });
      await new Promise((r) => setTimeout(r, 0));
      expect(calls.some((c) => c.endsWith("/oauth2/revoke"))).toBe(true);
    } finally {
      process.env.X_CLIENT_ID = prev.id;
      process.env.X_CLIENT_SECRET = prev.secret;
    }
  });

  it("Discord / Telegram membership statuses", async () => {
    const prev = { d: process.env.DISCORD_BOT_TOKEN, t: process.env.TELEGRAM_BOT_TOKEN };
    process.env.DISCORD_BOT_TOKEN = "bot";
    process.env.TELEGRAM_BOT_TOKEN = TOKEN;
    try {
      expect(await discordMember("1", "2", (async () => json({ roles: ["9"], joined_at: "2024-01-01T00:00:00Z" })) as typeof fetch)).toMatchObject({ status: "member", roles: ["9"] });
      expect(await discordMember("1", "2", (async () => json({ code: 10007 }, 404)) as typeof fetch)).toEqual({ status: "not_member" });
      expect(await discordMember("1", "2", (async () => json({ code: 10004 }, 404)) as typeof fetch)).toEqual({ status: "bot_missing" });
      expect(await telegramMember("@c", "5", (async () => json({ ok: true, result: { status: "member" } })) as typeof fetch)).toMatchObject({ status: "member" });
      expect(await telegramMember("@c", "5", (async () => json({ ok: true, result: { status: "left" } })) as typeof fetch)).toEqual({ status: "not_member" });
      expect(await telegramMember("@c", "5", (async () => json({ ok: false, description: "Bad Request: chat not found" })) as typeof fetch)).toEqual({ status: "bot_missing" });
    } finally {
      process.env.DISCORD_BOT_TOKEN = prev.d;
      process.env.TELEGRAM_BOT_TOKEN = prev.t;
    }
    expect(discordCreatedAt("175928847299117063")).toBe(1462015105);
  });
});

// ───────────────────────────── tasks ─────────────────────────────

describe("account tasks", () => {
  it("x_account: needs a linked, fresh, verified account with enough reach", async () => {
    const kv = createMemoryKv();
    const cfg = xAccountTask.configSchema.parse({ verified: "any", minFollowers: 100, minAccountAgeDays: 30 });
    expect((await xAccountTask.verify(cfg, ctx({ kv }))).message).toContain("Link your X");
    await saveLink(kv, ALICE, { provider: "x", id: "1", username: "al", verifiedType: "none", followers: 500, accountCreatedAt: NOW - 400 * 86_400 }, NOW);
    expect((await xAccountTask.verify(cfg, ctx({ kv }))).status).toBe("failed");
    await saveLink(kv, ALICE, { provider: "x", id: "1", username: "al", verifiedType: "blue", followers: 50, accountCreatedAt: NOW - 400 * 86_400 }, NOW);
    expect((await xAccountTask.verify(cfg, ctx({ kv }))).message).toContain("followers");
    await saveLink(kv, ALICE, { provider: "x", id: "1", username: "al", verifiedType: "blue", followers: 500, accountCreatedAt: NOW - 400 * 86_400 }, NOW);
    expect((await xAccountTask.verify(cfg, ctx({ kv }))).status).toBe("passed");
    expect((await xAccountTask.verify(cfg, ctx({ kv, now: NOW + 40 * 86_400 }))).message).toContain("out of date");
    const biz = xAccountTask.configSchema.parse({ verified: "business" });
    expect((await xAccountTask.verify(biz, ctx({ kv }))).status).toBe("failed");
  });

  it("discord_member and telegram_member use the linked id and the bot", async () => {
    const kv = createMemoryKv();
    await saveLink(kv, ALICE, { provider: "discord", id: "175928847299117063", username: "al" }, NOW);
    await saveLink(kv, ALICE, { provider: "telegram", id: "4242", username: "al" }, NOW);
    const prev = { d: process.env.DISCORD_BOT_TOKEN, t: process.env.TELEGRAM_BOT_TOKEN };
    process.env.DISCORD_BOT_TOKEN = "bot";
    process.env.TELEGRAM_BOT_TOKEN = "123456789:AAH-test-token-abcdefghijklmnopqrstuv";
    try {
      const dcfg = discordMemberTask.configSchema.parse({ guildId: "175928847299117063", roleIds: ["111111111111111111"] });
      const member = (roles: string[]) => (async () => json({ roles })) as typeof fetch;
      expect((await discordMemberTask.verify(dcfg, ctx({ kv, fetch: member(["111111111111111111"]) }))).status).toBe("passed");
      expect((await discordMemberTask.verify(dcfg, ctx({ kv, fetch: member([]) }))).message).toContain("role");
      expect((await discordMemberTask.verify(dcfg, ctx({ kv, fetch: (async () => json({ code: 10004 }, 404)) as typeof fetch }))).status).toBe("unavailable");
      const tcfg = telegramMemberTask.configSchema.parse({ chatId: "@basebuilders" });
      expect((await telegramMemberTask.verify(tcfg, ctx({ kv, fetch: (async () => json({ ok: true, result: { status: "administrator" } })) as typeof fetch }))).status).toBe("passed");
      expect((await telegramMemberTask.verify(tcfg, ctx({ claimer: BOB, kv }))).message).toContain("Link your Telegram");
    } finally {
      process.env.DISCORD_BOT_TOKEN = prev.d;
      process.env.TELEGRAM_BOT_TOKEN = prev.t;
    }
  });

  it("x_post must come from the linked X account when one is linked", async () => {
    const kv = createMemoryKv();
    await saveLink(kv, ALICE, { provider: "x", id: "1", username: "alice" }, NOW);
    const code = walletPostCode(BigInt(2_000_000_001), ALICE, "t1");
    const oembed = (author: string) => (async () => json({ author_url: `https://twitter.com/${author}`, html: `<p>${code}</p>` })) as typeof fetch;
    const cfg = xPostTask.configSchema.parse({});
    const sub = { url: "https://x.com/someone/status/1234567890123" };
    expect((await xPostTask.verify(cfg, ctx({ kv, submission: sub, fetch: oembed("someoneelse") }))).message).toContain("@alice");
    expect((await xPostTask.verify(cfg, ctx({ kv, submission: sub, fetch: oembed("alice") }))).status).toBe("passed");
  });
});

// ───────────────────────────── secrets at rest ─────────────────────────────

describe("drop settings are encrypted at rest", () => {
  const SIGNER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
  let prev: { s?: string; k?: string };
  beforeEach(() => {
    prev = { s: process.env.DROPS_TICKET_SIGNER_KEY, k: process.env.VOUCHER_SECRETS_KEY };
    process.env.DROPS_TICKET_SIGNER_KEY = SIGNER_KEY;
    process.env.VOUCHER_SECRETS_KEY = randomBytes(32).toString("base64");
  });
  afterEach(() => {
    for (const [k, v] of [["DROPS_TICKET_SIGNER_KEY", prev.s], ["VOUCHER_SECRETS_KEY", prev.k]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("webhook secrets and quiz hashes aren't readable in storage", async () => {
    const kv = createMemoryKv();
    const raw = new Map<string, string>();
    const spyKv = { ...kv, set: async (k: string, v: string, t?: number) => (raw.set(k, v), kv.set(k, v, t)) };
    const drop = {
      creator: "0x00000000000000000000000000000000c0ffee00",
      token: "0x1111111111111111111111111111111111111111",
      amountPerClaim: BigInt(1),
      maxAmountPerClaim: BigInt(1),
      budget: BigInt(10),
      createdAt: NOW,
      unlockAt: 0,
      expiresAt: NOW + 86_400,
      ticketSigner: privateKeyToAccount(SIGNER_KEY).address,
      allowlistRoot: `0x${"0".repeat(64)}`,
      committed: false,
      paused: false,
      closed: false,
    };
    const d: DropDeps = {
      contract: "0x1111111111111111111111111111111111111111",
      client: { readContract: async () => [drop, "", ""], getCode: async () => undefined } as unknown as DropDeps["client"],
      kv: spyKv,
      fetch: fetch,
      env: {},
      now: () => NOW,
    };
    const id = BigInt(2_000_000_001);
    await saveDefinition(d, id, drop.creator, {
      version: 1,
      tasks: [{ id: "hook", type: "webhook", config: { url: "https://api.example.com/x", secret: "super-secret-value-123" } }],
    });
    const stored = [...raw.values()].find((v) => v.startsWith("vsb1."));
    expect(stored && isSealed(stored)).toBe(true);
    expect([...raw.values()].some((v) => v.includes("super-secret-value-123"))).toBe(false);
    expect((await loadDefinition(d, id))?.tasks[0]?.config).toMatchObject({ secret: "super-secret-value-123" });
  });
});
