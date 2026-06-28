/** Quick smoke test for Blockscout v2 activity fetch. */
const addr = process.argv[2] || "0x6b444856ee67fc9872c59d35ff8a8f744af717f2";
const BASE = "https://base.blockscout.com/api/v2";

async function fetchPages(path, max = 8) {
  let url = `${BASE}${path}`;
  const items = [];
  for (let i = 0; i < max; i++) {
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data.items)) break;
    items.push(...data.items);
    const next = data.next_page_params;
    if (!next) break;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) {
      if (v != null && v !== "") qs.set(k, String(v));
    }
    url = `${BASE}${path}?${qs}`;
  }
  return items;
}

const [tokens, internals, externals] = await Promise.all([
  fetchPages(`/addresses/${addr}/token-transfers`, 8),
  fetchPages(`/addresses/${addr}/internal-transactions`, 6),
  fetchPages(`/addresses/${addr}/transactions`, 4),
]);

const days = new Set(
  [...tokens, ...internals, ...externals]
    .map((x) => x.timestamp)
    .filter(Boolean)
    .map((t) => t.slice(0, 10))
);

console.log(
  JSON.stringify(
    {
      address: addr,
      tokenTransfers: tokens.length,
      internalTxs: internals.length,
      externalTxs: externals.length,
      total: tokens.length + internals.length + externals.length,
      uniqueDays: days.size,
    },
    null,
    2
  )
);
