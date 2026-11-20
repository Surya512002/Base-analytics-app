/**
 * Recommend per-order caps from LIVE Base mainnet liquidity.
 *
 * For every market in config/deployConfig.json this quotes buy (USDC -> token) and sell (token -> USDC)
 * ladders through Uniswap V3 QuoterV2, compares each fill to the Chainlink oracle price, and reports the
 * largest order that keeps the all-in shortfall under an impact budget.
 *
 *   node scripts/recommend-caps.mjs                 # table only
 *   node scripts/recommend-caps.mjs --json out.json # also write machine-readable result
 *   BASE_MAINNET_RPC=https://... node scripts/recommend-caps.mjs
 *
 * Caps are enforced on-chain per market (LimitOrderBook.setMarket, owner only). This script never sends a
 * transaction: it only tells the owner what is defensible. See docs/ORDER-CAPS.md.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, parseAbi, getAddress, formatUnits } from "viem";
import { base } from "viem/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RPC_URL = process.env.BASE_MAINNET_RPC || "https://mainnet.base.org";
const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

const QUOTER_V2 = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
const USDC = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 ticksCrossed,uint256 gasEstimate)",
]);
const feedAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
]);
const erc20Abi = parseAbi(["function decimals() view returns (uint8)"]);

/** USD sizes tested (per order) */
const LADDER_USD = [100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000];
/** Max tolerated all-in shortfall vs oracle, in bps, by risk stage. Fees of the pool are included. */
const BUDGET_BPS = { canary: 100, stage1: 60, stage2: 40 };

async function quote(tokenIn, tokenOut, amountIn, fee) {
  try {
    const { result } = await client.simulateContract({
      address: QUOTER_V2,
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
    });
    return result[0];
  } catch {
    return null; // pool too shallow for that size, or quoter reverted
  }
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "../config/deployConfig.json"), "utf8"));
  const jsonOut = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;
  const out = [];

  for (const m of cfg.markets) {
    const token = getAddress(m.stockToken);
    const [tokDec, feedDec, round] = await Promise.all([
      client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
      client.readContract({ address: m.feed, abi: feedAbi, functionName: "decimals" }),
      client.readContract({ address: m.feed, abi: feedAbi, functionName: "latestRoundData" }),
    ]);
    const oracle = Number(round[1]) / 10 ** feedDec; // USD per whole token
    const ageSec = Math.floor(Date.now() / 1000) - Number(round[3]);

    const rows = [];
    for (const usd of LADDER_USD) {
      const usdcIn = BigInt(Math.round(usd * 1e6));
      const tokensOutBuy = await quote(USDC, token, usdcIn, m.poolFee);
      const tokenInSell = BigInt(Math.floor((usd / oracle) * 10 ** tokDec));
      const usdcOutSell = tokenInSell > 0n ? await quote(token, USDC, tokenInSell, m.poolFee) : null;

      // Shortfall vs oracle in bps (positive = worse than oracle)
      const buyShort = tokensOutBuy == null ? null : (1 - Number(formatUnits(tokensOutBuy, tokDec)) * oracle / usd) * 1e4;
      const sellShort = usdcOutSell == null ? null : (1 - Number(formatUnits(usdcOutSell, 6)) / usd) * 1e4;
      rows.push({ usd, buyShort, sellShort, worst: buyShort == null || sellShort == null ? null : Math.max(buyShort, sellShort) });
    }

    const best = (budget) => {
      let ok = 0;
      for (const r of rows) if (r.worst != null && r.worst <= budget) ok = r.usd;
      return ok;
    };
    const rec = Object.fromEntries(Object.entries(BUDGET_BPS).map(([k, v]) => [k, best(v)]));
    out.push({ symbol: m.symbol, oracle, oracleAgeSec: ageSec, poolFee: m.poolFee, configuredDeviationBps: m.maxDeviationBps, rows, rec });

    console.log(`\n${m.symbol}  oracle $${oracle.toFixed(oracle < 10 ? 4 : 2)}  feed age ${ageSec}s  pool fee ${m.poolFee / 100}bp  deviation bound ${m.maxDeviationBps}bp`);
    console.log("  size USD   buy shortfall   sell shortfall");
    for (const r of rows) {
      const f = (v) => (v == null ? "  n/a (no depth)" : `${v.toFixed(1).padStart(8)} bp`);
      console.log(`  ${String(r.usd).padStart(8)}   ${f(r.buyShort)}   ${f(r.sellShort)}`);
    }
    console.log(`  recommended max per order -> canary(<=${BUDGET_BPS.canary}bp): $${rec.canary}  stage1(<=${BUDGET_BPS.stage1}bp): $${rec.stage1}  stage2(<=${BUDGET_BPS.stage2}bp): $${rec.stage2}`);
  }

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify({ generatedAt: new Date().toISOString(), budgetsBps: BUDGET_BPS, markets: out }, null, 2));
    console.log(`\nWrote ${jsonOut}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
