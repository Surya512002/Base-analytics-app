/**
 * Which tokenized stocks are actually live (minted) on Base.
 * Runs via `npm run stocks:sync` and rewrites lib/stocks/live-stocks.generated.ts.
 *
 * - Coinbase stocks: Coinbase's public list, https://api.coinbase.com/v1/tokenized-stocks.
 *   It only lists stocks with tokens in circulation (total_supply > 0). base.org's registry
 *   also lists stocks Coinbase has deployed but not launched yet; those have zero supply and
 *   cannot be bought, swapped, lent or gifted, so the app hides them until they launch.
 * - Other issuers in the registry (Dinari, Backed, …): live when totalSupply() > 0 onchain.
 *
 * Nothing here is invented: a stock missing from both checks is simply not shown.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../lib/stocks/live-stocks.generated.ts");
const REGISTRY = resolve(__dirname, "../lib/stocks/tokenized-stocks-registry.ts");
const RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Every page of Coinbase's list: it returns 100 stocks at a time. */
async function coinbaseTokens() {
  const tokens = [];
  let pageToken = "";
  for (let page = 0; page < 50; page++) {
    const url = new URL("https://api.coinbase.com/v1/tokenized-stocks");
    url.searchParams.set("limit", "100");
    if (pageToken) url.searchParams.set("page_token", pageToken);
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`Coinbase API ${r.status}`);
    const j = await r.json();
    if (!Array.isArray(j.tokens)) throw new Error("Coinbase API returned no tokens");
    tokens.push(...j.tokens);
    // A token that repeats means paging is not advancing: stop rather than write a partial list.
    if (j.next_page_token && j.next_page_token === pageToken) throw new Error("Coinbase paging did not advance");
    pageToken = j.next_page_token || "";
    if (!pageToken) break;
  }
  if (pageToken) throw new Error("Coinbase list is longer than expected");
  if (tokens.length === 0) throw new Error("Coinbase API returned no tokens");
  if (new Set(tokens.map((t) => t.contract_address)).size !== tokens.length) throw new Error("Coinbase pages overlap");
  return tokens;
}

async function coinbaseLiveStocks() {
  const tokens = await coinbaseTokens();
  return tokens
    .filter((t) => /^0x[0-9a-fA-F]{40}$/.test(t.contract_address) && Number(t.total_supply) > 0)
    .map((t) => ({
      symbol: String(t.symbol),
      name: String(t.name).trim(),
      address: t.contract_address,
      icon: typeof t.icon_url === "string" && t.icon_url.startsWith("https://") ? t.icon_url : "",
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/** A stock is "liquid" when its Base DEX pools together hold at least this much. */
const MIN_LIQUIDITY_USD = 10_000;

/** Addresses with enough DEX liquidity to trade in the app, deepest first. */
async function liquidStocks(addresses) {
  const depth = new Map();
  for (let i = 0; i < addresses.length; i += 30) {
    const chunk = addresses.slice(i, i + 30);
    const r = await fetch(`https://api.dexscreener.com/tokens/v1/base/${chunk.join(",")}`, { signal: AbortSignal.timeout(20_000) });
    // A partial list would quietly drop stocks from the app, so stop instead.
    if (!r.ok) throw new Error(`DexScreener ${r.status}`);
    for (const pair of await r.json()) {
      const a = String(pair.baseToken?.address ?? "").toLowerCase();
      depth.set(a, (depth.get(a) ?? 0) + (Number(pair.liquidity?.usd) || 0));
    }
    await sleep(300);
  }
  const liquid = addresses.filter((a) => (depth.get(a.toLowerCase()) ?? 0) >= MIN_LIQUIDITY_USD);
  if (liquid.length === 0) throw new Error("DexScreener showed no liquid stock");
  return liquid.sort((a, b) => depth.get(b.toLowerCase()) - depth.get(a.toLowerCase()));
}

async function totalSupplies(addresses) {
  const out = new Map();
  for (let i = 0; i < addresses.length; i += 8) {
    const chunk = addresses.slice(i, i + 8);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await (
          await fetch(RPC, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(
              chunk.map((to, id) => ({ jsonrpc: "2.0", id, method: "eth_call", params: [{ to, data: "0x18160ddd" }, "latest"] }))
            ),
          })
        ).json();
        if (!Array.isArray(res) || res.some((x) => x.error && x.error.code === -32016) ) throw new Error("rate limited");
        for (const x of res) {
          const ok = typeof x.result === "string" && x.result.length > 2;
          out.set(chunk[x.id].toLowerCase(), ok ? BigInt(x.result) : null);
        }
        break;
      } catch {
        await sleep(1500 * (attempt + 1));
      }
    }
    await sleep(300);
  }
  return out;
}

async function main() {
  const coinbase = await coinbaseLiveStocks();
  const coinbaseAddrs = new Set(coinbase.map((s) => s.address.toLowerCase()));

  // Non-Coinbase registry entries (anything not at a Coinbase B20 address).
  const src = readFileSync(REGISTRY, "utf8");
  const others = [...src.matchAll(/address:\s*getAddress\("(0x[0-9a-fA-F]{40})"\)/g)]
    .map((m) => m[1])
    .filter((a) => !a.toLowerCase().startsWith("0xb2000000"));
  const supplies = await totalSupplies([...new Set(others)]);
  const otherLive = [...supplies.entries()].filter(([, v]) => v != null && v > 0n).map(([a]) => a).sort();
  const unknown = [...supplies.entries()].filter(([, v]) => v == null).map(([a]) => a);

  const liquid = await liquidStocks(coinbase.map((s) => s.address));
  const readAt = new Date().toISOString().slice(0, 10);
  const body = `/**
 * GENERATED by scripts/sync-live-stocks.mjs (\`npm run stocks:sync\`). Do not edit by hand.
 * Read ${readAt}.
 *
 * Tokenized stocks that are live on Base: tokens actually exist (total supply > 0).
 * Coinbase stocks come from https://api.coinbase.com/v1/tokenized-stocks; other issuers from
 * an onchain totalSupply() check. Everything else in the registry is hidden until it launches.
 */
export const LIVE_STOCKS_READ_AT = "${readAt}";

/** [symbol, name, address, icon] for every Coinbase stock with tokens in circulation. */
export const COINBASE_LIVE_STOCKS: ReadonlyArray<readonly [string, string, \`0x\${string}\`, string]> = [
${coinbase.map((s) => `  [${JSON.stringify(s.symbol)}, ${JSON.stringify(s.name)}, "${s.address}", ${JSON.stringify(s.icon)}],`).join("\n")}
];

/**
 * Lower-case addresses of Coinbase stocks with at least $${MIN_LIQUIDITY_USD.toLocaleString("en-US")} of Base DEX liquidity, deepest
 * first. These are the ones market lists and charts show.
 */
export const COINBASE_LIQUID_STOCKS: readonly string[] = [
${liquid.map((a) => `  "${a.toLowerCase()}",`).join("\n")}
];

/** Lower-case addresses of other issuers' stocks with a non-zero onchain supply. */
export const OTHER_LIVE_STOCK_ADDRESSES: readonly string[] = [
${otherLive.map((a) => `  "${a}",`).join("\n")}
];
`;
  writeFileSync(OUT, body);
  console.log(
    `stocks:sync — ${coinbase.length} live Coinbase stocks (${liquid.length} liquid), ${otherLive.length}/${supplies.size} other issuers live` +
      (unknown.length ? `, ${unknown.length} unreadable (kept hidden)` : "")
  );
}

main().catch((e) => {
  console.error("stocks:sync failed:", e.message);
  process.exit(1);
});
