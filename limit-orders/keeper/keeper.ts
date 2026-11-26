/**
 * Keeper bot for LimitOrderBook v2.
 *
 * Every poll it:
 *   1. ratchets trailing stops up when the price makes a new high (updateTrailing)
 *   2. executes limit / take-profit / stop-loss / trailing / bracket orders whose trigger was hit (executeOrder)
 *   3. refunds expired orders so users get their deposit back automatically (refundExpired)
 *   4. executes due recurring-buy plans (executeDca), after checking the owner's signed plan rules (optional,
 *      see keeper/rulesFilter.ts: set KEEPER_RULES_URL and KEEPER_RULES_TOKEN to turn it on)
 *
 * Anyone can run a keeper: the caller earns `keeperFeeBps` of each output.
 * Optional: VALIDITY_TX=1 submits executeOrder through Base's `base_sendRawTransactionValidity` with a block_number
 * upper bound, so a delayed transaction can never land late. It falls back to a normal transaction if that fails.
 *
 * Run:  npx tsx keeper/keeper.ts
 */
import {
  createPublicClient, createWalletClient, http, encodeFunctionData, toHex, formatEther, concat,
  type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia, hardhat } from "viem/chains";
import { orderBookAbi } from "../shared/abi";
import { builderDataSuffix } from "../shared/builderCode";
import { createRulesFilter, type Fetched } from "./rulesFilter";
import "../shared/loadEnv";

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") throw new Error(`Missing env var ${name}`);
  return v;
}

const CHAIN_NAME = env("CHAIN", "base");
const CHAIN = CHAIN_NAME === "baseSepolia" ? baseSepolia : CHAIN_NAME === "hardhat" ? hardhat : base;
const RPC_URL = env("RPC_URL");
const SEQUENCER_RPC_URL = process.env.SEQUENCER_RPC_URL; // only needed for VALIDITY_TX=1
const ORDER_BOOK = env("ORDER_BOOK") as Address;
const POLL_MS = Number(env("POLL_MS", "5000"));
const START_ORDER_ID = BigInt(env("START_ORDER_ID", "1"));
const START_PLAN_ID = BigInt(env("START_PLAN_ID", "1"));
const VALIDITY_TX = env("VALIDITY_TX", "0") === "1";
const AUTO_REFUND_EXPIRED = env("AUTO_REFUND_EXPIRED", "1") === "1";
const MIN_GAS_BALANCE_ETH = Number(env("MIN_GAS_BALANCE_ETH", "0.00005"));
const DRY_RUN = env("DRY_RUN", "0") === "1";
const RETRY_BACKOFF_MS = 60_000;
const BUILDER_SUFFIX = builderDataSuffix();

const pk = env("KEEPER_PK", DRY_RUN ? "0x0000000000000000000000000000000000000000000000000000000000000001" : undefined);
if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) throw new Error("KEEPER_PK must be a 0x-prefixed 32-byte hex key");
const account = privateKeyToAccount(pk as Hex);

const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: CHAIN, transport: http(RPC_URL) });

type OrderTuple = {
  owner: Address; expiry: number; orderType: number; status: number; trailBps: number; stockToken: Address;
  triggerPrice: bigint; amountIn: bigint; minAmountOut: bigint; peakPrice: bigint; linkedId: bigint;
};
type PlanTuple = {
  owner: Address; status: number; remaining: number; interval: number; nextTime: number;
  stockToken: Address; maxPrice: bigint; amountPerBuy: bigint;
};
const OPEN = 1;
const TRAILING_STOP = 3;
type WriteFn = "executeOrder" | "refundExpired" | "updateTrailing" | "executeDca";

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
const firstLine = (e: unknown) => (e as Error).message.split("\n")[0];

// Plan rules (optional). Off unless both settings exist, so the keeper behaves exactly as before.
const RULES_URL = process.env.KEEPER_RULES_URL?.trim();
const RULES_TOKEN = process.env.KEEPER_RULES_TOKEN?.trim();
const RULES_ON = Boolean(RULES_URL && RULES_TOKEN && RULES_TOKEN.length >= 24);
const rulesFilter = createRulesFilter(
  { enabled: RULES_ON, chainId: CHAIN.id, orderBook: ORDER_BOOK, refreshMs: Number(process.env.KEEPER_RULES_REFRESH_MS) || undefined },
  {
    async fetchEntries(plans) {
      const out: Fetched = { entries: {}, holds: {} };
      for (let i = 0; i < plans.length; i += 200) {
        const chunk = plans.slice(i, i + 200);
        const owners = [...new Set(chunk.map((p) => p.owner.toLowerCase()))];
        const r = await fetch(`${RULES_URL}?chainId=${CHAIN.id}&ids=${chunk.map((p) => p.id).join(",")}&owners=${owners.join(",")}`, {
          headers: { authorization: `Bearer ${RULES_TOKEN}` },
          signal: AbortSignal.timeout(8_000),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as Partial<Fetched>;
        Object.assign(out.entries, j.entries ?? {});
        Object.assign(out.holds, j.holds ?? {});
      }
      return out;
    },
    verify: ({ address, message, signature }) =>
      publicClient.verifyMessage({ address: address as Address, message, signature: signature as Hex }),
    async readPrice(stockToken) {
      const [price] = (await publicClient.readContract({ address: ORDER_BOOK, abi: orderBookAbi, functionName: "currentPrice", args: [stockToken as Address] })) as readonly [bigint, bigint];
      return price > 0n ? Number(price) / 1e8 : null;
    },
    async fetchHistory(stockToken) {
      const start = Math.floor(Date.now() / 1000) - 35 * 86_400;
      const r = await fetch(`https://coins.llama.fi/chart/base:${stockToken}?start=${start}&span=35&period=1d`, { signal: AbortSignal.timeout(8_000) });
      if (!r.ok) return [];
      const j = (await r.json()) as { coins?: Record<string, { prices?: Array<{ timestamp: number; price: number }> }> };
      const series = Object.values(j.coins ?? {})[0]?.prices ?? [];
      return series.map((p) => ({ t: p.timestamp, c: p.price }));
    },
    now: () => new Date(),
    log: (m) => log(m),
  }
);

const openOrders = new Map<bigint, OrderTuple>();
const openPlans = new Map<bigint, PlanTuple>();
const backoffUntil = new Map<string, number>();
let orderScanFrom = START_ORDER_ID;
let planScanFrom = START_PLAN_ID;
let running = true;

const backedOff = (key: string) => (backoffUntil.get(key) ?? 0) > Date.now();
const backoff = (key: string) => backoffUntil.set(key, Date.now() + RETRY_BACKOFF_MS);
const minKey = (m: Map<bigint, unknown>, dflt: bigint) => [...m.keys()].reduce<bigint>((a, k) => (k < a ? k : a), dflt);

/** Re-read from the lowest id that may still be open; returns the new scan start. */
async function refreshRange<T extends { status: number }>(
  next: bigint,
  scanFrom: bigint,
  cache: Map<bigint, T>,
  fetchRange: (from: bigint, to: bigint) => Promise<readonly [readonly bigint[], readonly T[]]>,
): Promise<bigint> {
  const last = next - 1n;
  let from = minKey(cache, scanFrom);
  if (from > scanFrom) from = scanFrom;
  while (from <= last) {
    const to = from + 99n > last ? last : from + 99n;
    const [ids, list] = await fetchRange(from, to);
    ids.forEach((id, i) => {
      const item = list[i];
      if (item.status === OPEN) cache.set(id, item);
      else cache.delete(id);
    });
    from = to + 1n;
  }
  const lowest = [...cache.keys()].reduce<bigint | null>((m, k) => (m === null || k < m ? k : m), null);
  return lowest ?? next;
}

async function refresh(): Promise<void> {
  const [nextOrder, nextPlan] = await Promise.all([
    publicClient.readContract({ address: ORDER_BOOK, abi: orderBookAbi, functionName: "nextOrderId" }),
    publicClient.readContract({ address: ORDER_BOOK, abi: orderBookAbi, functionName: "nextPlanId" }),
  ]);
  orderScanFrom = await refreshRange<OrderTuple>(nextOrder, orderScanFrom, openOrders, async (from, to) => {
    const r = await publicClient.readContract({ address: ORDER_BOOK, abi: orderBookAbi, functionName: "getOrdersRange", args: [from, to] });
    return r as unknown as readonly [readonly bigint[], readonly OrderTuple[]];
  });
  planScanFrom = await refreshRange<PlanTuple>(nextPlan, planScanFrom, openPlans, async (from, to) => {
    const r = await publicClient.readContract({ address: ORDER_BOOK, abi: orderBookAbi, functionName: "getPlansRange", args: [from, to] });
    return r as unknown as readonly [readonly bigint[], readonly PlanTuple[]];
  });
}

async function sendNormal(id: bigint, fn: WriteFn): Promise<Hex> {
  const { request } = await publicClient.simulateContract({
    account, address: ORDER_BOOK, abi: orderBookAbi, functionName: fn, args: [id], dataSuffix: BUILDER_SUFFIX,
  });
  return walletClient.writeContract({ ...request, dataSuffix: BUILDER_SUFFIX });
}

/** Submit executeOrder via Base validity transactions (block_number upper bound). */
async function sendValidity(id: bigint): Promise<Hex> {
  if (!SEQUENCER_RPC_URL) throw new Error("SEQUENCER_RPC_URL not set");
  const data = concat([encodeFunctionData({ abi: orderBookAbi, functionName: "executeOrder", args: [id] }), BUILDER_SUFFIX]);
  await publicClient.simulateContract({ account, address: ORDER_BOOK, abi: orderBookAbi, functionName: "executeOrder", args: [id] });
  const [gas, fees, nonce, latest] = await Promise.all([
    publicClient.estimateGas({ account, to: ORDER_BOOK, data }),
    publicClient.estimateFeesPerGas(),
    publicClient.getTransactionCount({ address: account.address, blockTag: "pending" }),
    publicClient.getBlockNumber(),
  ]);
  const raw = await account.signTransaction({
    chainId: CHAIN.id, type: "eip1559", nonce, to: ORDER_BOOK, data, value: 0n,
    gas: (gas * 13n) / 10n, maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  const validity = [{ type: "block_number", params: { op: "<=", value: toHex(latest + 10n) } }];
  const res = await fetch(SEQUENCER_RPC_URL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "base_sendRawTransactionValidity", params: [raw, { validity }] }),
  });
  const body = (await res.json()) as { result?: Hex; error?: { message: string } };
  if (body.error || !body.result) throw new Error(body.error?.message ?? "validity RPC returned no hash");
  return body.result;
}

/** Sends one transaction and waits for it. Returns true on success. Failures are logged and backed off. */
async function run(label: string, key: string, fn: WriteFn, id: bigint, useValidity = false): Promise<boolean> {
  try {
    if (DRY_RUN) {
      log(`[DRY_RUN] Simulated execution: would call ${fn}(${id}) for ${label}`);
      return true;
    }
    let hash: Hex;
    if (useValidity && VALIDITY_TX) {
      try { hash = await sendValidity(id); }
      catch (e) { log(`${label}: validity tx failed (${firstLine(e)}), using normal tx`); hash = await sendNormal(id, fn); }
    } else {
      hash = await sendNormal(id, fn);
    }
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
    log(`${label}: ${receipt.status} in block ${receipt.blockNumber} (${hash})`);
    if (receipt.status === "success") return true;
    backoff(key);
    return false;
  } catch (e) {
    // Usually slippage, the oracle fill guard, or liquidity: the simulation reverted, the order stays open and we retry later.
    log(`${label}: failed: ${firstLine(e)}`);
    backoff(key);
    return false;
  }
}

const canExecute = (id: bigint) =>
  publicClient.readContract({ address: ORDER_BOOK, abi: orderBookAbi, functionName: "canExecute", args: [id] });

async function handleOrder(id: bigint, o: OrderTuple): Promise<void> {
  const key = `o${id}`;
  if (backedOff(key)) return;
  const nowSec = Math.floor(Date.now() / 1000);
  const dropSibling = () => { if (o.linkedId !== 0n) openOrders.delete(o.linkedId); };

  if (o.expiry < nowSec) {
    if (AUTO_REFUND_EXPIRED && (await run(`order ${id}: expired, refunding`, key, "refundExpired", id))) {
      openOrders.delete(id);
      dropSibling();
    }
    return;
  }

  // Trailing stop: ratchet the stop up first, then check the trigger with the new stop.
  if (o.orderType === TRAILING_STOP) {
    const canPoke = await publicClient.readContract({ address: ORDER_BOOK, abi: orderBookAbi, functionName: "canUpdateTrailing", args: [id] });
    if (canPoke) await run(`order ${id}: trailing stop up`, `t${id}`, "updateTrailing", id);
  }

  if (!(await canExecute(id))) return;
  log(`order ${id}: trigger hit, executing`);
  if (await run(`order ${id}`, key, "executeOrder", id, true)) {
    openOrders.delete(id);
    dropSibling(); // a filled bracket leg cancels its sibling on-chain
  }
}

async function handlePlan(id: bigint): Promise<void> {
  const key = `p${id}`;
  if (backedOff(key)) return;
  const due = await publicClient.readContract({ address: ORDER_BOOK, abi: orderBookAbi, functionName: "canExecuteDca", args: [id] });
  if (!due) return;
  const plan = openPlans.get(id);
  if (plan) {
    const decision = await rulesFilter.check(String(id), { owner: plan.owner, stockToken: plan.stockToken });
    if (!decision.run) return; // the owner's rules say wait; the run stays due and is checked again next poll
  }
  log(`plan ${id}: run due, executing`);
  await run(`plan ${id}`, key, "executeDca", id);
  // the next refresh() picks up the new state (remaining / completed)
}

async function tick(): Promise<void> {
  const bal = await publicClient.getBalance({ address: account.address });
  if (Number(formatEther(bal)) < MIN_GAS_BALANCE_ETH) log(`WARNING: keeper gas balance low (${formatEther(bal)} ETH)`);
  await refresh();
  for (const [id, o] of [...openOrders.entries()]) {
    if (!running) return;
    await handleOrder(id, o); // sequential on purpose: one tx at a time keeps nonces simple
  }
  await rulesFilter.refresh([...openPlans.entries()].map(([id, p]) => ({ id: String(id), owner: p.owner })));
  for (const id of [...openPlans.keys()]) {
    if (!running) return;
    await handlePlan(id);
  }
}

async function main(): Promise<void> {
  log(`keeper ${account.address} watching ${ORDER_BOOK} on ${CHAIN.name} (validity=${VALIDITY_TX}, plan rules ${RULES_ON ? "on" : "off"})`);
  try {
    const [only, allowed] = await Promise.all([
      publicClient.readContract({ address: ORDER_BOOK, abi: orderBookAbi, functionName: "keeperOnly" }),
      publicClient.readContract({ address: ORDER_BOOK, abi: orderBookAbi, functionName: "isKeeper", args: [account.address] }),
    ]);
    if (only && !allowed && !DRY_RUN) {
      throw new Error(`keeper ${account.address} is not allowlisted. From the owner Safe call setKeeper(${account.address}, true).`);
    }
  } catch (e) {
    if (String(e).includes("not allowlisted")) throw e;
    log("could not read keeper allowlist (older deployment?):", firstLine(e));
  }
  process.on("SIGINT", () => { running = false; log("stopping..."); });
  process.on("SIGTERM", () => { running = false; log("stopping..."); });
  while (running) {
    try { await tick(); } catch (e) { log("tick error:", firstLine(e)); }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
