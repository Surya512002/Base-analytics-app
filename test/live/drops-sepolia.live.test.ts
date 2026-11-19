/**
 * Live end-to-end test of Drops on Base Sepolia: the app's own code (prepareDrop, link / code /
 * allowlist signing, the server's task checks, tickets and raffle) against a real deployed
 * BaseDrops. Expected failures are checked with eth_call simulation (no gas).
 *
 * Runs only when these are set (testnet-only keys, never mainnet):
 *   SEPOLIA_E2E_DROPS, SEPOLIA_E2E_GATE, SEPOLIA_E2E_CREATOR_KEY, SEPOLIA_E2E_C1_KEY, SEPOLIA_E2E_C2_KEY
 *   optional SEPOLIA_E2E_OUT=<file> to save tx hashes, SEPOLIA_RPC
 *   npx vitest run test/live/drops-sepolia.live.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, parseEventLogs, type Hex, type PublicClient } from "viem";
import { baseSepolia } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const E = process.env;
const ready = Boolean(E.SEPOLIA_E2E_DROPS && E.SEPOLIA_E2E_CREATOR_KEY && E.SEPOLIA_E2E_C1_KEY && E.SEPOLIA_E2E_C2_KEY);
const RPC = E.SEPOLIA_RPC || "https://sepolia.base.org";
const T = 600_000;

type Lib = {
  client: typeof import("@/lib/drops/client");
  merkle: typeof import("@/lib/drops/merkle");
  abi: typeof import("@/lib/drops/abi");
  service: typeof import("@/lib/drops/service");
  kv: typeof import("@/lib/drops/kv");
  network: typeof import("@/lib/drops/network");
  api: typeof import("@/components/drops/drops-api");
};

const log: Array<{ step: string; tx?: string; result: string }> = [];
const note = (step: string, result: string, tx?: string) => log.push({ step, result, tx });

describe.skipIf(!ready)("Drops on Base Sepolia (live)", () => {
  let L: Lib;
  let pub: PublicClient;
  const creator = privateKeyToAccount((E.SEPOLIA_E2E_CREATOR_KEY ?? generatePrivateKey()) as Hex);
  const c1 = privateKeyToAccount((E.SEPOLIA_E2E_C1_KEY ?? generatePrivateKey()) as Hex);
  const c2 = privateKeyToAccount((E.SEPOLIA_E2E_C2_KEY ?? generatePrivateKey()) as Hex);
  const ticketKey = generatePrivateKey();
  const DROPS = (E.SEPOLIA_E2E_DROPS ?? "0x") as `0x${string}`;
  const wallet = (acct: typeof creator) => createWalletClient({ account: acct, chain: baseSepolia, transport: http(RPC) });

  beforeAll(async () => {
    E.NEXT_PUBLIC_DROPS_CHAIN_ID = "84532";
    E.NEXT_PUBLIC_DROPS_RPC_URL = RPC;
    E.NEXT_PUBLIC_DROPS_CONTRACT = DROPS;
    E.NEXT_PUBLIC_DROPS_TOKEN_GATE = E.SEPOLIA_E2E_GATE ?? "";
    E.DROPS_TICKET_SIGNER_KEY = ticketKey;
    L = {
      client: await import("@/lib/drops/client"),
      merkle: await import("@/lib/drops/merkle"),
      abi: await import("@/lib/drops/abi"),
      service: await import("@/lib/drops/service"),
      kv: await import("@/lib/drops/kv"),
      network: await import("@/lib/drops/network"),
      api: await import("@/components/drops/drops-api"),
    };
    pub = createPublicClient({ chain: baseSepolia, transport: http(RPC) }) as PublicClient;
    expect(L.network.DROPS_CHAIN_ID).toBe(84532);
    expect(L.client.DROPS_CONTRACT.toLowerCase()).toBe(DROPS.toLowerCase());
  }, T);

  afterAll(() => {
    if (E.SEPOLIA_E2E_OUT) writeFileSync(E.SEPOLIA_E2E_OUT, JSON.stringify(log, null, 2));
  });

  // ───────────────────────────── helpers ─────────────────────────────

  async function send(acct: typeof creator, functionName: string, args: unknown[], value?: bigint) {
    const hash = await wallet(acct).writeContract({ address: DROPS, abi: L.abi.BASE_DROPS_ABI, functionName: functionName as never, args: args as never, value } as never);
    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
    expect(receipt.status).toBe("success");
    return receipt;
  }

  /** eth_call the claim (or any fn) and return the revert reason ("" = would succeed). */
  async function why(acct: typeof creator, functionName: string, args: unknown[]): Promise<string> {
    try {
      await pub.simulateContract({ account: acct, address: DROPS, abi: L.abi.BASE_DROPS_ABI, functionName: functionName as never, args: args as never } as never);
      return "";
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }

  async function create(form: ReturnType<Lib["client"]["defaultForm"]>, step: string) {
    const now = Number((await pub.getBlock()).timestamp);
    const r = L.client.prepareDrop(form, { now, appTicketSigner: privateKeyToAccount(ticketKey).address, creator: creator.address });
    if (!r.ok) throw new Error(r.error);
    const receipt = await send(creator, "createDrop", [r.prepared.params], r.prepared.params.budget);
    const ev = parseEventLogs({ abi: L.abi.BASE_DROPS_ABI, logs: receipt.logs, eventName: "DropCreated" })[0];
    const id = ev!.args.dropId as bigint;
    note(`${step}: create drop ${id}`, "ok", receipt.transactionHash);
    return { id, prepared: r.prepared };
  }

  const eth = (s: string) => ({ ...L.client.defaultForm("group"), token: L.client.ZERO_ADDRESS, symbol: "ETH", decimals: 18, amountPerClaim: s });

  function deps() {
    const client = L.network.createDropsPublicClient();
    return {
      contract: DROPS,
      client: client as unknown as Parameters<Lib["service"]["issueTicket"]>[0]["client"],
      kv: L.kv.createMemoryKv(),
      fetch,
      env: {},
      now: () => Math.floor(Date.now() / 1000),
    };
  }

  // ───────────────────────────── scenarios ─────────────────────────────

  it("link drop: claim once, wallet-bound proof, app reads it back", async () => {
    const { id, prepared } = await create({ ...eth("0.00002"), totalClaims: 2, maxClaimsPerWallet: 1 }, "link");
    const sig1 = await L.client.signLink(prepared.linkKey!, DROPS, id, c1.address);
    const args1 = { ...L.client.emptyClaimArgs(), linkSig: sig1 };
    const before = await pub.getBalance({ address: c1.address });
    const rc = await send(c1, "claim", [id, args1]);
    note("link: c1 claims", "paid", rc.transactionHash);
    expect(await pub.getBalance({ address: c1.address })).toBeGreaterThan(before - BigInt(1e13));
    expect(await why(c1, "claim", [id, args1])).toContain("Wallet claim limit reached");
    expect(await why(c2, "claim", [id, args1])).toContain("Invalid link");
    note("link: c1 again / c2 with c1's proof", "refused (limit / invalid link)");
    const view = await L.api.readDropView(id);
    expect(view?.claimedCount).toBe(1);
    expect((await L.api.readWalletStatus(id, c1.address)).blocker).toBe("Wallet claim limit reached");
    expect((await L.api.readWalletStatus(id, c2.address)).blocker).toBe("");
    note("link: app reads drop + wallet status", "1 claimed; c1 blocked; c2 allowed");
  }, T);

  it("gift cards: each code once, code bound to the redeeming wallet", async () => {
    const { id, prepared } = await create({ ...eth("0.00002"), preset: "cards", access: ["codes"], codeCount: 2, totalClaims: 2 }, "cards");
    const links = prepared.codeKeys.map((k) => new URL(L.client.codeLink("https://example.app", id, k, prepared.codeKeys)));
    const parsed = links.map((u) => L.client.parseDropLink(u.pathname, u.hash));
    const argsFor = async (i: number, who: string) => ({
      ...L.client.emptyClaimArgs(),
      code: privateKeyToAccount(parsed[i]!.codeKey!).address,
      codeProof: parsed[i]!.codeProof,
      codeSig: await L.client.signCode(parsed[i]!.codeKey!, DROPS, id, who),
    });
    note("cards: c1 redeems code 1", "paid", (await send(c1, "claim", [id, await argsFor(0, c1.address)])).transactionHash);
    expect(await why(c2, "claim", [id, await argsFor(0, c2.address)])).toContain("Code already used");
    expect(await why(c2, "claim", [id, { ...(await argsFor(1, c1.address)) }])).toContain("Invalid code signature");
    note("cards: reuse code 1 / c2 with c1-signed code 2", "refused");
    note("cards: c2 redeems code 2", "paid", (await send(c2, "claim", [id, await argsFor(1, c2.address)])).transactionHash);
  }, T);

  it("allowlist: listed wallet claims, others refused", async () => {
    const { id } = await create({ ...eth("0.00002"), preset: "holders", access: ["allowlist"], allowlist: c1.address, totalClaims: 2 }, "allowlist");
    const proof = L.merkle.buildAddressTree([c1.address]).proof(c1.address)!;
    note("allowlist: c1 claims", "paid", (await send(c1, "claim", [id, { ...L.client.emptyClaimArgs(), allowlistProof: proof }])).transactionHash);
    expect(await why(c2, "claim", [id, { ...L.client.emptyClaimArgs(), allowlistProof: proof }])).toContain("Not on allowlist");
    note("allowlist: c2", "refused (not on allowlist)");
  }, T);

  it("token-holder gate: wallet without the token is refused", async () => {
    if (!L.client.DROPS_TOKEN_GATE) return;
    const { id } = await create(
      { ...eth("0.00002"), preset: "holders", access: ["holders"], holderToken: L.network.DROPS_USDC, holderMin: "1", holderDecimals: 6, totalClaims: 1 },
      "gate"
    );
    expect(await why(c1, "claim", [id, L.client.emptyClaimArgs()])).toContain("Gate check failed");
    note("gate: c1 holds no USDC", "refused (gate check failed)");
    note("gate: creator closes", "refunded", (await send(creator, "close", [id])).transactionHash);
  }, T);

  it("daily faucet: cooldown blocks, then allows after it passes", async () => {
    const { id, prepared } = await create({ ...eth("0.00001"), preset: "faucet", access: ["link"], totalClaims: 0, budget: "0.00005", maxClaimsPerWallet: 0, cooldownHours: 0.01, perDayCap: 100 }, "cooldown");
    const args = { ...L.client.emptyClaimArgs(), linkSig: await L.client.signLink(prepared.linkKey!, DROPS, id, c1.address) };
    note("cooldown: c1 claim #1", "paid", (await send(c1, "claim", [id, args])).transactionHash);
    expect(await why(c1, "claim", [id, args])).toContain("Cooldown active");
    const ws = await L.api.readWalletStatus(id, c1.address);
    expect(ws.nextClaimAt).toBeGreaterThan(0);
    note("cooldown: immediate re-claim", "refused (cooldown active)");
    await new Promise((r) => setTimeout(r, 45_000));
    note("cooldown: c1 claim #2 after 45s", "paid", (await send(c1, "claim", [id, args])).transactionHash);
  }, T);

  it("task drop: server checks tasks and signs a ticket the contract accepts; no replay", async () => {
    const { id } = await create(
      { ...eth("0.00002"), preset: "quest", access: ["tasks"], totalClaims: 2, rewardMode: "random", randomMin: "0.00001", randomMax: "0.00003" },
      "tasks"
    );
    const d = deps();
    await L.service.saveDefinition(d, id, creator.address, { version: 1, tasks: [{ id: "word", type: "secret_word", config: { answers: ["gm base"] } }], rewards: { mode: "random", min: "10000000000000", max: "30000000000000" } });
    expect((await L.service.checkTask(d, id, c1.address, "word", { answer: "nope" })).status).toBe("failed");
    expect((await L.service.checkTask(d, id, c1.address, "word", { answer: "GM Base!" })).status).toBe("passed");
    const t = await L.service.issueTicket(d, id, c1.address);
    const amt = BigInt(t.amount);
    expect(amt >= BigInt(10_000_000_000_000) && amt <= BigInt(30_000_000_000_000)).toBe(true);
    const args = { ...L.client.emptyClaimArgs(), amount: amt, deadline: BigInt(t.deadline), ticket: t.ticket };
    note(`tasks: c1 claims with app ticket (${amt} wei)`, "paid", (await send(c1, "claim", [id, args])).transactionHash);
    expect(await why(c1, "claim", [id, args])).toMatch(/Invalid ticket|Wallet claim limit/);
    expect(await why(c2, "claim", [id, args])).toContain("Invalid ticket");
    await expect(L.service.issueTicket(d, id, c2.address)).rejects.toMatchObject({ status: 403 });
    note("tasks: replay / c2 with c1's ticket / c2 without tasks", "refused");
  }, T);

  it("raffle: entries, fair draw on a real block, only the winner can claim", async () => {
    const { id } = await create({ ...eth("0.00002"), preset: "quest", access: ["tasks"], totalClaims: 1 }, "raffle");
    const d = deps();
    const drawAt = Math.floor(Date.now() / 1000) + 40;
    const saved = await L.service.saveDefinition(d, id, creator.address, {
      version: 1,
      tasks: [{ id: "word", type: "secret_word", config: { answers: ["onchain"] } }],
      raffle: { winners: 1, drawAt },
    });
    for (const w of [c1, c2]) {
      await L.service.checkTask(d, id, w.address, "word", { answer: "onchain" });
      await L.service.enterRaffle(d, id, w.address);
    }
    await new Promise((r) => setTimeout(r, 45_000));
    const res = await L.service.drawRaffle(d, id);
    expect(res.winners).toHaveLength(1);
    expect(L.merkle && (await import("@/lib/drops/rewards")).raffleCommit(res.seed)).toBe(saved.raffle?.commit);
    const winner = res.winners[0] === c1.address.toLowerCase() ? c1 : c2;
    const loser = winner === c1 ? c2 : c1;
    note(`raffle: drawn on block ${res.blockNumber}`, `winner ${winner.address.slice(0, 8)}…`);
    await expect(L.service.issueTicket(d, id, loser.address)).rejects.toThrow(/wasn't drawn/);
    const t = await L.service.issueTicket(d, id, winner.address);
    const args = { ...L.client.emptyClaimArgs(), amount: BigInt(t.amount), deadline: BigInt(t.deadline), ticket: t.ticket };
    note("raffle: winner claims", "paid", (await send(winner, "claim", [id, args])).transactionHash);
  }, T);

  it("recovery: new link, pause, move to another wallet, refund goes to the new owner; locked drops stay locked", async () => {
    const { id, prepared } = await create({ ...eth("0.00002"), totalClaims: 2 }, "recovery");
    const oldSig = await L.client.signLink(prepared.linkKey!, DROPS, id, c1.address);
    const newKey = generatePrivateKey();
    note("recovery: rotate link key", "ok", (await send(creator, "rotateLinkSigner", [id, privateKeyToAccount(newKey).address])).transactionHash);
    expect(await why(c1, "claim", [id, { ...L.client.emptyClaimArgs(), linkSig: oldSig }])).toContain("Invalid link");
    note("recovery: old link", "refused (invalid link)");
    note("recovery: pause", "ok", (await send(creator, "setPaused", [id, true])).transactionHash);
    const newArgs = { ...L.client.emptyClaimArgs(), linkSig: await L.client.signLink(newKey, DROPS, id, c1.address) };
    expect(await why(c1, "claim", [id, newArgs])).toContain("Drop paused");
    note("recovery: resume", "ok", (await send(creator, "setPaused", [id, false])).transactionHash);
    note("recovery: c1 claims with the new link", "paid", (await send(c1, "claim", [id, newArgs])).transactionHash);
    note("recovery: start move to c2", "ok", (await send(creator, "transferCreator", [id, c2.address])).transactionHash);
    note("recovery: c2 accepts", "ok", (await send(c2, "acceptCreator", [id])).transactionHash);
    expect(await why(creator, "close", [id])).toContain("Only creator");
    const before = await pub.getBalance({ address: c2.address });
    note("recovery: c2 closes", "refund to c2", (await send(c2, "close", [id])).transactionHash);
    expect(await pub.getBalance({ address: c2.address })).toBeGreaterThan(before - BigInt(1e13));

    const locked = await create({ ...eth("0.00001"), totalClaims: 1, committed: true }, "locked");
    expect(await why(creator, "close", [locked.id])).toContain("Committed until expiry");
    expect(await why(creator, "setPaused", [locked.id, true])).toContain("Committed drop");
    note("locked: close / pause before expiry", "refused");
  }, T);
});
