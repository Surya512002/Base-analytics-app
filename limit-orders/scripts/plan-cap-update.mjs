/**
 * Plan (never send) an on-chain cap update for the deployed LimitOrderBook.
 *
 * The contract owner (a multisig on mainnet) is the only account that can change caps, via
 * setMarket(). This script reads the live market config, compares it with config/deployConfig.json,
 * and prints Safe-ready calldata for every market whose caps (or other params) differ. It does not hold
 * keys and does not broadcast.
 *
 *   BOOK_ADDRESS=0x... node scripts/plan-cap-update.mjs
 *   BOOK_ADDRESS=0x... node scripts/plan-cap-update.mjs --refresh-from-oracle
 *
 * --refresh-from-oracle re-derives each market's token-unit cap (maxStockIn) from its USD cap (maxQuoteIn)
 * and the current Chainlink price. Token-unit caps drift with price (a stock that doubles doubles its USD
 * cap), so the owner should refresh them periodically, or whenever a price moves more than ~25%.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, parseAbi, getAddress, encodeFunctionData, formatUnits } from "viem";
import { base } from "viem/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RPC_URL = process.env.BASE_MAINNET_RPC || "https://mainnet.base.org";
const BOOK = process.env.BOOK_ADDRESS;
if (!BOOK || !/^0x[0-9a-fA-F]{40}$/.test(BOOK)) {
  console.error("Set BOOK_ADDRESS to the deployed LimitOrderBook address.");
  process.exit(1);
}
const refresh = process.argv.includes("--refresh-from-oracle");
const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

const bookAbi = parseAbi([
  "function owner() view returns (address)",
  "function markets(address) view returns (address feed,uint8 feedDecimals,uint8 stockDecimals,bool enabled,uint32 maxStaleness,uint16 maxDeviationBps,address adapter,uint128 maxStockIn,uint128 maxQuoteIn)",
  "function setMarket(address stockToken,address feed,uint32 maxStaleness,address adapter,uint128 maxStockIn,uint128 maxQuoteIn,uint16 maxDeviationBps,bool enabled)",
]);
const feedAbi = parseAbi(["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"]);

/** Hard ceiling per order until an external audit is complete (USD, 6-dec USDC units). Raise only with sign-off. */
const PRE_AUDIT_CEILING_QUOTE = 5_000_000_000n; // $5,000

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "../config/deployConfig.json"), "utf8"));
const book = getAddress(BOOK);

console.log(`LimitOrderBook ${book}\nowner ${await client.readContract({ address: book, abi: bookAbi, functionName: "owner" })}\n`);

let changes = 0;
for (const m of cfg.markets) {
  const token = getAddress(m.stockToken);
  const live = await client.readContract({ address: book, abi: bookAbi, functionName: "markets", args: [token] });
  const [feed, feedDec, stockDec, enabled, maxStaleness, maxDev, adapter, liveStock, liveQuote] = live;
  if (feed === "0x0000000000000000000000000000000000000000") {
    console.log(`${m.symbol}: not configured on-chain yet (use scripts/deploy.js).`);
    continue;
  }

  let wantQuote = BigInt(m.maxQuoteIn);
  let wantStock = BigInt(m.maxStockIn);
  if (wantQuote > PRE_AUDIT_CEILING_QUOTE) throw new Error(`${m.symbol}: maxQuoteIn exceeds the pre-audit ceiling`);
  if (refresh) {
    const round = await client.readContract({ address: feed, abi: feedAbi, functionName: "latestRoundData" });
    const price = Number(round[1]) / 10 ** feedDec;
    const usd = Number(wantQuote) / 1e6;
    wantStock = BigInt(Math.floor(((usd / price) * 10 ** stockDec) * 0.99)); // 1% under the USD cap
  }

  const same = wantStock === liveStock && wantQuote === liveQuote && m.maxDeviationBps === maxDev && m.maxStaleness === maxStaleness;
  const fmt = (v, d) => formatUnits(v, d);
  console.log(
    `${m.symbol}: stock cap ${fmt(liveStock, stockDec)} -> ${fmt(wantStock, stockDec)} | quote cap $${fmt(liveQuote, 6)} -> $${fmt(wantQuote, 6)} | deviation ${maxDev} -> ${m.maxDeviationBps}bp | staleness ${maxStaleness} -> ${m.maxStaleness}s ${same ? "(no change)" : ""}`
  );
  if (same) continue;
  changes++;
  const data = encodeFunctionData({
    abi: bookAbi,
    functionName: "setMarket",
    args: [token, feed, m.maxStaleness, adapter, wantStock, wantQuote, m.maxDeviationBps, enabled],
  });
  console.log(`  Safe tx -> to: ${book}  value: 0\n  data: ${data}\n`);
}
console.log(changes ? `${changes} market(s) need a setMarket transaction from the owner.` : "On-chain caps already match config.");
