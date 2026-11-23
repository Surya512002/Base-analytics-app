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
 *   BOOK_ADDRESS=0x... node scripts/plan-cap-update.mjs --safe-json cap-update.json
 *
 * --safe-json writes the transactions as a file the Safe app can import (Transaction Builder >
 * Upload a JSON), so nobody copies hex by hand. Review it in the Safe before signing.
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
const safeJsonIdx = process.argv.indexOf("--safe-json");
const safeJsonOut = safeJsonIdx > -1 ? process.argv[safeJsonIdx + 1] : null;
const safeTxs = [];
const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

const bookAbi = parseAbi([
  "function owner() view returns (address)",
  "function markets(address) view returns (address feed,uint8 feedDecimals,uint8 stockDecimals,bool enabled,uint32 maxStaleness,uint16 maxDeviationBps,address adapter,uint128 maxStockIn,uint128 maxQuoteIn)",
  "function maxStockEscrow(address) view returns (uint128)",
  "function maxQuoteEscrow(address) view returns (uint128)",
  "function setEscrowCaps(address stockToken,uint128 maxStock,uint128 maxQuote)",
  "function setMarket(address stockToken,address feed,uint32 maxStaleness,address adapter,uint128 maxStockIn,uint128 maxQuoteIn,uint16 maxDeviationBps,bool enabled)",
]);
const feedAbi = parseAbi(["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"]);

/** Hard ceiling per order until an external audit is complete (USD, 6-dec USDC units). Raise only with sign-off. */
const PRE_AUDIT_CEILING_QUOTE = 25_000_000_000n; // $25,000 per order, only with escrow ceilings in place

const cfgPath = process.env.DEPLOY_CONFIG ? path.resolve(process.env.DEPLOY_CONFIG) : path.join(__dirname, "../config/deployConfig.json");
console.log(`Comparing against ${cfgPath}`);
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
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
  if (m.maxQuoteEscrow === undefined || m.maxStockEscrow === undefined) throw new Error(`${m.symbol}: set maxStockEscrow and maxQuoteEscrow (total value at risk) before raising caps`);
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
  const [liveEscStock, liveEscQuote] = await Promise.all([
    client.readContract({ address: book, abi: bookAbi, functionName: "maxStockEscrow", args: [token] }),
    client.readContract({ address: book, abi: bookAbi, functionName: "maxQuoteEscrow", args: [token] }),
  ]);
  const wantEscStock = BigInt(m.maxStockEscrow);
  const wantEscQuote = BigInt(m.maxQuoteEscrow);
  if (liveEscStock !== wantEscStock || liveEscQuote !== wantEscQuote) {
    changes++;
    console.log(`  escrow ceilings: stock ${fmt(liveEscStock, stockDec)} -> ${fmt(wantEscStock, stockDec)} | quote ${fmt(liveEscQuote, 6)} -> ${fmt(wantEscQuote, 6)}`);
    const escData = encodeFunctionData({ abi: bookAbi, functionName: "setEscrowCaps", args: [token, wantEscStock, wantEscQuote] });
    safeTxs.push({ to: book, value: "0", data: escData, contractMethod: null, contractInputsValues: null });
    console.log(`  Safe tx -> to: ${book}  value: 0\n  data: ${escData}\n`);
  }
  if (same) continue;
  changes++;
  const data = encodeFunctionData({
    abi: bookAbi,
    functionName: "setMarket",
    args: [token, feed, m.maxStaleness, adapter, wantStock, wantQuote, m.maxDeviationBps, enabled],
  });
  safeTxs.push({ to: book, value: "0", data, contractMethod: null, contractInputsValues: null });
  console.log(`  Safe tx -> to: ${book}  value: 0\n  data: ${data}\n`);
}
if (safeJsonOut && safeTxs.length) {
  const out = {
    version: "1.0",
    chainId: "8453",
    createdAt: Date.now(),
    meta: { name: `Order book cap update (${path.basename(cfgPath)})`, description: "Generated by plan-cap-update.mjs. Review every call in the Safe before signing.", txBuilderVersion: "1.17.0" },
    transactions: safeTxs,
  };
  fs.writeFileSync(safeJsonOut, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${safeTxs.length} transaction(s) to ${safeJsonOut} for import in the Safe app.`);
}
console.log(changes ? `${changes} transaction(s) needed from the owner.` : "On-chain caps already match config.");
