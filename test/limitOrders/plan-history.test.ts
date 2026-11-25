import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { orderBookAbi } from "@/limit-orders/shared/abi";
import { fillsFromLogs, planProgress, summarize, type PlanFill, type PlanState, type RawLog } from "@/limit-orders/shared/planHistory";
import { loadPlanHistory, MAX_RECEIPTS, type HistoryDeps } from "@/lib/plans/history-server";

const BOOK = "0x080D52b060A467aE63d7d2cC7178dc6B1A3DB29D";
const OWNER = "0x00000000000000000000000000000000000000a1";
const OTHER = "0x00000000000000000000000000000000000000b2";
const KEEPER = "0x00000000000000000000000000000000000000c3";
const usdc = (n: number) => BigInt(Math.round(n * 1e6));
const stk = (n: number) => BigInt(Math.round(n * 1e8));
const DEC = { stock: 8, quote: 6 };

/** A DcaExecuted log exactly as the contract encodes it. */
function log(a: { id: bigint; owner?: string; amountIn: bigint; out: bigint; remaining: bigint; address?: string }): RawLog {
  const topics = encodeEventTopics({ abi: orderBookAbi, eventName: "DcaExecuted", args: { id: a.id, owner: (a.owner ?? OWNER) as `0x${string}`, keeper: KEEPER as `0x${string}` } });
  const event = orderBookAbi.find((x) => x.type === "event" && x.name === "DcaExecuted") as { inputs: ReadonlyArray<{ indexed?: boolean; type: string; name: string }> };
  const plain = event.inputs.filter((i) => !i.indexed);
  const values: Record<string, bigint> = { price: 200n * 10n ** 8n, amountIn: a.amountIn, stockToOwner: a.out, keeperFee: 1n, remaining: a.remaining };
  const data = encodeAbiParameters(plain as never, plain.map((i) => (i.type === "uint256" ? values[i.name] : Number(values[i.name]))) as never);
  return { address: a.address ?? BOOK, topics: topics as string[], data };
}

describe("fillsFromLogs", () => {
  it("reads this owner's runs from the order book's events", () => {
    const f = fillsFromLogs([log({ id: 4n, amountIn: usdc(10), out: stk(0.05), remaining: 2n })], BOOK, OWNER.toLowerCase(), "0xt", 100);
    expect(f).toEqual([{ planId: "4", amountIn: "10000000", received: "5000000", remaining: 2, txHash: "0xt", time: 100 }]);
  });
  it("ignores other owners, look-alike events from other contracts, and unknown logs", () => {
    const logs = [
      log({ id: 1n, owner: OTHER, amountIn: 1n, out: 1n, remaining: 0n }),
      log({ id: 2n, amountIn: 1n, out: 1n, remaining: 0n, address: OTHER }), // a fake emitter
      { address: BOOK, topics: [`0x${"ab".repeat(32)}`], data: "0x" },
    ];
    expect(fillsFromLogs(logs, BOOK, OWNER, "0xt", null)).toEqual([]);
  });
});

const plan = (over: Partial<PlanState> = {}): PlanState => ({ id: "4", status: 1, remaining: 1, isSell: false, amountPerRun: usdc(10), ...over });
const fill = (over: Partial<PlanFill> = {}): PlanFill => ({ planId: "4", amountIn: String(usdc(10)), received: String(stk(0.05)), remaining: 2, txHash: "0x1", time: 100, ...over });

describe("planProgress", () => {
  const two = [fill({ remaining: 2, txHash: "0x1", received: String(stk(0.05)) }), fill({ remaining: 1, txHash: "0x2", received: String(stk(0.04)), time: 200 })];

  it("adds up runs, money, tokens and the average price", () => {
    const p = planProgress(plan(), two, DEC);
    expect(p).toMatchObject({ runsDone: 2, runsTotal: 3, spent: usdc(20), received: stk(0.09), lastRunAt: 200, complete: true });
    expect(p.avgPrice).toBeCloseTo(20 / 0.09, 6);
  });
  it("does not count the same run twice, or another plan's runs", () => {
    const p = planProgress(plan(), [...two, two[0], fill({ planId: "5", txHash: "0x9" })], DEC);
    expect(p.runsDone).toBe(2);
  });
  it("says when history is missing: the newest run, a gap, or all runs of a finished plan", () => {
    expect(planProgress(plan({ remaining: 0 }), two, DEC).complete).toBe(false);
    const gap = [fill({ remaining: 3, txHash: "0x1" }), fill({ remaining: 1, txHash: "0x2" })];
    expect(planProgress(plan(), gap, DEC).complete).toBe(false);
    expect(planProgress(plan({ status: 2, remaining: 0 }), [], DEC).complete).toBe(false);
  });
  it("a new plan with no runs is complete, with no average price", () => {
    const p = planProgress(plan({ remaining: 3 }), [], DEC);
    expect(p).toMatchObject({ runsDone: 0, runsTotal: 3, avgPrice: null, complete: true });
  });
  it("works for recurring sells: average sale price is USDC received per token sold", () => {
    const sell = plan({ isSell: true, remaining: 0, status: 2, amountPerRun: stk(0.5) });
    const p = planProgress(sell, [fill({ remaining: 0, amountIn: String(stk(0.5)), received: String(usdc(110)) })], DEC);
    expect(p.avgPrice).toBeCloseTo(220, 6);
  });
});

describe("summarize", () => {
  const row = (pl: PlanState, fills: PlanFill[], priceNow: number | null) => ({ plan: pl, progress: planProgress(pl, fills, DEC), priceNow, decimals: DEC });

  it("totals invested, today's value, change and what is still waiting", () => {
    const s = summarize([row(plan(), [fill({ remaining: 1 })], 220)]);
    expect(s.invested).toBeCloseTo(10, 6);
    expect(s.valueNow).toBeCloseTo(11, 6); // 0.05 x 220
    expect(s.changePct).toBeCloseTo(10, 6);
    expect(s.waiting).toBeCloseTo(10, 6);
    expect(s.runsDone).toBe(1);
  });
  it("shows no value rather than a wrong one when a price is missing", () => {
    const s = summarize([row(plan(), [fill({ remaining: 1 })], 220), row(plan({ id: "5" }), [fill({ planId: "5", remaining: 1, txHash: "0x7" })], null)]);
    expect(s.valueNow).toBeNull();
    expect(s.changePct).toBeNull();
    expect(s.invested).toBeCloseTo(20, 6);
  });
  it("counts nothing waiting for cancelled or finished plans, and keeps sells separate", () => {
    const sell = plan({ id: "6", isSell: true, remaining: 0, status: 2 });
    const s = summarize([
      row(plan({ status: 3, remaining: 5 }), [], 220),
      row(sell, [fill({ planId: "6", remaining: 0, amountIn: String(stk(0.1)), received: String(usdc(21)) })], 220),
    ]);
    expect(s.waiting).toBe(0);
    expect(s.invested).toBe(0);
    expect(s.soldFor).toBeCloseTo(21, 6);
    expect(s.valueNow).toBeNull();
  });
});

describe("loadPlanHistory", () => {
  type Call = { method: string; params: unknown[] };
  function fake(pages: Array<{ hashes: string[]; pageKey?: string }>, opts: { missing?: string[] } = {}) {
    const calls: Call[] = [];
    let page = 0;
    const deps: HistoryDeps = {
      async rpcBatch(batch) {
        calls.push(...batch);
        return batch.map((c) => {
          if (c.method === "alchemy_getAssetTransfers") {
            const p = pages[page++] ?? { hashes: [] };
            return { transfers: p.hashes.map((hash) => ({ hash, metadata: { blockTimestamp: "2026-11-25T10:00:00.000Z" } })), pageKey: p.pageKey };
          }
          const hash = (c.params as string[])[0];
          if (opts.missing?.includes(hash)) return null;
          const n = parseInt(hash.slice(-4), 16);
          return { logs: [log({ id: 4n, amountIn: usdc(10), out: stk(0.05), remaining: BigInt(n) })] };
        });
      },
    };
    return { deps, calls };
  }
  const h = (n: number, tag: string) => `0x${tag}${n.toString(16).padStart(4, "0")}`;

  it("finds the wallet's runs through the transfers the book sent it, asking for both addresses", async () => {
    const { deps, calls } = fake([{ hashes: [h(1, "aa"), h(0, "aa"), h(1, "aa")] }]);
    const r = await loadPlanHistory({ orderBook: BOOK, owner: OWNER }, deps);
    expect(r.partial).toBe(false);
    expect(r.fills.map((f) => f.remaining)).toEqual([1, 0]);
    expect(r.fills[0].time).toBe(Math.floor(Date.parse("2026-11-25T10:00:00.000Z") / 1000));
    expect(calls[0].params[0]).toMatchObject({ fromAddress: BOOK, toAddress: OWNER, category: ["erc20"] });
    expect(calls.filter((c) => c.method === "eth_getTransactionReceipt")).toHaveLength(2); // duplicates fetched once
  });
  it("keeps receipts, so a second look asks only for new ones", async () => {
    const first = fake([{ hashes: [h(2, "bb")] }]);
    await loadPlanHistory({ orderBook: BOOK, owner: OWNER }, first.deps);
    const second = fake([{ hashes: [h(3, "bb"), h(2, "bb")] }]);
    await loadPlanHistory({ orderBook: BOOK, owner: OWNER }, second.deps);
    expect(second.calls.filter((c) => c.method === "eth_getTransactionReceipt")).toHaveLength(1);
  });
  it("marks the history partial when a receipt cannot be read, and when there is more than it will fetch", async () => {
    const miss = fake([{ hashes: [h(4, "cc"), h(5, "cc")] }], { missing: [h(5, "cc")] });
    expect((await loadPlanHistory({ orderBook: BOOK, owner: OWNER }, miss.deps)).partial).toBe(true);
    const many = fake([{ hashes: Array.from({ length: MAX_RECEIPTS + 5 }, (_, i) => h(i, "dd")) }]);
    const r = await loadPlanHistory({ orderBook: BOOK, owner: OWNER }, many.deps);
    expect(r.partial).toBe(true);
    expect(r.fills.length).toBe(MAX_RECEIPTS);
    const paged = fake([1, 2, 3].map((p) => ({ hashes: [h(p, "ee")], pageKey: "more" })));
    expect((await loadPlanHistory({ orderBook: BOOK, owner: OWNER }, paged.deps)).partial).toBe(true);
  });
  it("fails loudly when the lookup itself fails, instead of showing an empty history", async () => {
    await expect(loadPlanHistory({ orderBook: BOOK, owner: OWNER }, { rpcBatch: async () => [null] })).rejects.toThrow(/lookup failed/);
    await expect(loadPlanHistory({ orderBook: BOOK, owner: OWNER }, { rpcBatch: async () => { throw new Error("RPC 429"); } })).rejects.toThrow(/429/);
  });
});
