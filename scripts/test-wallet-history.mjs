#!/usr/bin/env node
/** Quick sanity check: compare Blockscout v1 vs capped v2 pagination. */
const addr = process.argv[2] || "0xbCDDd1bc8F3c0c24BEDEE41720287ff50a7B7148";

async function v1Count(action) {
  let page = 1;
  let total = 0;
  while (page <= 50) {
    const url = `https://base.blockscout.com/api?module=account&action=${action}&address=${addr}&startblock=0&endblock=99999999&page=${page}&offset=10000&sort=asc`;
    const data = await fetch(url).then((r) => r.json());
    const rows = data.result;
    if (!Array.isArray(rows) || !rows.length) break;
    total += rows.length;
    if (rows.length < 10000) break;
    page++;
  }
  return total;
}

async function v2Count(path, maxPages = 500) {
  let url = `https://base.blockscout.com/api/v2${path}`;
  let total = 0;
  let pages = 0;
  while (pages < maxPages) {
    const data = await fetch(url).then((r) => r.json());
    total += data.items?.length || 0;
    pages++;
    if (!data.next_page_params) break;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(data.next_page_params)) {
      if (v != null && v !== "") qs.set(k, String(v));
    }
    url = `https://base.blockscout.com/api/v2${path}?${qs}`;
  }
  return { total, pages };
}

const base = `/addresses/${addr.toLowerCase()}`;
console.log("Wallet:", addr);
const t0 = Date.now();
const [v1tx, v1tok, v1int, v2ext] = await Promise.all([
  v1Count("txlist"),
  v1Count("tokentx"),
  v1Count("txlistinternal"),
  v2Count(`${base}/transactions`),
]);
console.log({
  v1_txlist: v1tx,
  v1_tokentx: v1tok,
  v1_internal: v1int,
  v2_transactions: v2ext,
  seconds: ((Date.now() - t0) / 1000).toFixed(1),
});
