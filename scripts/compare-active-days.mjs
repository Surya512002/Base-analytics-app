#!/usr/bin/env node
/** Compare active days: old caps (30 pages) vs full v1+v2 pagination. */
const addr = (process.argv[2] || "0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F").toLowerCase();
const BASE = "https://base.blockscout.com/api/v2";
const V1 = "https://base.blockscout.com/api";

function uniqueDaysFromLegs(legs) {
  const days = new Set();
  for (const tx of legs) {
    if (!tx.metadata?.blockTimestamp) continue;
    const from = (tx.from || "").toLowerCase();
    const to = (tx.to || "").toLowerCase();
    if (from !== addr && to !== addr) continue;
    days.add(tx.metadata.blockTimestamp.slice(0, 10));
  }
  return days.size;
}

async function v2Pages(path, maxPages) {
  let url = `${BASE}${path}`;
  const items = [];
  for (let i = 0; i < maxPages; i++) {
    const d = await (await fetch(url)).json();
    if (!d.items?.length) break;
    items.push(...d.items);
    if (!d.next_page_params) break;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(d.next_page_params))
      if (v != null && v !== "") qs.set(k, String(v));
    url = `${BASE}${path}?${qs}`;
  }
  return items;
}

async function v1All(action) {
  const legs = [];
  for (let page = 1; page <= 50; page++) {
    const url = `${V1}?module=account&action=${action}&address=${addr}&startblock=0&endblock=99999999&page=${page}&offset=10000&sort=desc`;
    const d = await (await fetch(url)).json();
    const rows = d.result;
    if (!Array.isArray(rows) || !rows.length || typeof rows[0] === "string") break;
    for (const r of rows) {
      legs.push({
        from: r.from,
        to: r.to,
        metadata: { blockTimestamp: new Date(Number(r.timeStamp) * 1000).toISOString() },
      });
    }
    if (rows.length < 10000) break;
  }
  return legs;
}

const base = `/addresses/${addr}`;
const t0 = Date.now();

const [oldTokens, oldExt, v1tx, v1tok, v1int, fullTokens, fullExt] =
  await Promise.all([
    v2Pages(`${base}/token-transfers`, 30),
    v2Pages(`${base}/transactions`, 20),
    v1All("txlist"),
    v1All("tokentx"),
    v1All("txlistinternal"),
    v2Pages(`${base}/token-transfers`, 300),
    v2Pages(`${base}/transactions`, 300),
  ]);

const oldLegs = [
  ...oldTokens.map((t) => ({
    from: t.from?.hash,
    to: t.to?.hash,
    metadata: { blockTimestamp: t.timestamp },
  })),
  ...oldExt.map((t) => ({
    from: t.from?.hash,
    to: t.to?.hash,
    metadata: { blockTimestamp: t.timestamp },
  })),
];

const newLegs = [
  ...v1tx,
  ...v1tok,
  ...v1int,
  ...fullTokens.map((t) => ({
    from: t.from?.hash,
    to: t.to?.hash,
    metadata: { blockTimestamp: t.timestamp },
  })),
  ...fullExt.map((t) => ({
    from: t.from?.hash,
    to: t.to?.hash,
    metadata: { blockTimestamp: t.timestamp },
  })),
];

console.log(
  JSON.stringify(
    {
      address: addr,
      old_v2_only_days: uniqueDaysFromLegs(oldLegs),
      new_v1_plus_v2_days: uniqueDaysFromLegs(newLegs),
      old_v2_legs: oldLegs.length,
      new_legs: newLegs.length,
      v1_tx: v1tx.length,
      v1_tok: v1tok.length,
      v1_int: v1int.length,
      full_v2_tok_pages: fullTokens.length,
      seconds: ((Date.now() - t0) / 1000).toFixed(1),
    },
    null,
    2
  )
);
