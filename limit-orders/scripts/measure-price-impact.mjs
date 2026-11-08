import "../shared/loadEnv.js";
import { createPublicClient, http, encodeFunctionData, decodeFunctionResult } from "viem";
import { base } from "viem/chains";

const RPC_URL = process.env.BASE_MAINNET_RPC || "https://mainnet.base.org";
const client = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const QUOTER_V2 = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";

const QUOTER_ABI = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
];

const FEED_ABI = [
  {
    name: "latestRoundData",
    type: "function",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
];

const POOL_ABI = [
  {
    name: "liquidity",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint128" }],
  },
];

const MARKETS = [
  {
    symbol: "NVDAc",
    address: "0xb20000000000000000000078ee7ce2fe4908108c",
    pool: "0x60661b315553EB81872deEA9a66d567Cf0CCd33B",
    fee: 3000,
    configuredDeviationBps: 300,
    feed: "0x04689a41629776563E6822F76f2e57D148d28513",
  },
  {
    symbol: "AAPLc",
    address: "0xb200000000000000000000c2e324d24d7eecd1fb",
    pool: "0x97F35d1E92795327614BE000cd18cba1Be2c1931",
    fee: 3000,
    configuredDeviationBps: 300,
    feed: "0x787f13dEa48Db0897CbCDD985de77809D837F988",
  },
  {
    symbol: "MSFTc",
    address: "0xb200000000000000000000ab99cfa739e253872b",
    pool: "0xD73cBeCC0F62C7C1704332ED119514d6d84DC607",
    fee: 10000,
    configuredDeviationBps: 350,
    feed: "0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c",
  },
  {
    symbol: "GOOGLc (0.3% pool - Configured)",
    address: "0xb2000000000000000000002d0ba3164cc74f58b7",
    pool: "0x8634EE4145A63E40E44e12A6Bb1B905Fcb8856a6",
    fee: 3000,
    configuredDeviationBps: 300,
    feed: "0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2",
  },
  {
    symbol: "GOOGLc (1.0% pool - Comparison)",
    address: "0xb2000000000000000000002d0ba3164cc74f58b7",
    pool: "0x1f52F46BaC657564c31122b12b43A459E09273C8",
    fee: 10000,
    configuredDeviationBps: 350,
    feed: "0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2",
  },
];

async function quoteExactIn(tokenIn, tokenOut, amountIn, fee) {
  try {
    const data = encodeFunctionData({
      abi: QUOTER_ABI,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
    });
    const res = await client.call({ to: QUOTER_V2, data });
    if (!res.data || res.data === "0x") return 0n;
    const decoded = decodeFunctionResult({
      abi: QUOTER_ABI,
      functionName: "quoteExactInputSingle",
      data: res.data,
    });
    return decoded[0];
  } catch (e) {
    return 0n;
  }
}

async function main() {
  const blockNumber = await client.getBlockNumber();
  const timestamp = Math.floor(Date.now() / 1000);
  const isoTime = new Date().toISOString();

  console.log("==========================================================================================");
  console.log("REAL PRICE IMPACT & ORACLE GUARD MEASUREMENT REPORT");
  console.log(`Base Mainnet RPC: ${RPC_URL}`);
  console.log(`Block Number: ${blockNumber}`);
  console.log(`Timestamp: ${timestamp} (${isoTime})`);
  console.log("==========================================================================================\n");

  const testAmountsUsd = [25, 50, 100];

  for (const m of MARKETS) {
    let poolLiq = "0";
    try {
      const liq = await client.readContract({
        address: m.pool,
        abi: POOL_ABI,
        functionName: "liquidity",
      });
      poolLiq = liq.toString();
    } catch (e) {
      poolLiq = "unavailable";
    }

    const round = await client.readContract({
      address: m.feed,
      abi: FEED_ABI,
      functionName: "latestRoundData",
    });
    const rawAnswer = round[1];
    const oraclePrice = Number(rawAnswer) / 1e8;

    console.log(`------------------------------------------------------------------------------------------`);
    console.log(`Market: ${m.symbol}`);
    console.log(`Stock Token: ${m.address}`);
    console.log(`Uniswap Pool: ${m.pool} | Fee Tier: ${(m.fee / 10000).toFixed(2)}% (${m.fee} bps)`);
    console.log(`Pool Liquidity: ${poolLiq}`);
    console.log(`Chainlink Oracle Price: $${oraclePrice.toFixed(4)} (raw: ${rawAnswer})`);
    console.log(`Configured maxDeviationBps: ${m.configuredDeviationBps} bps (${(m.configuredDeviationBps / 100).toFixed(2)}%)`);
    console.log(`------------------------------------------------------------------------------------------`);

    console.log(`\n[BUYS: USDC -> Stock] (amountIn in USDC, out in Stock units)`);
    console.log(`USD In | USDC In (units) | Oracle Ideal Stock | Actual Stock Out | Shortfall Bps | Passes Guard?`);
    console.log(`-------+-----------------+--------------------+------------------+---------------+--------------`);

    for (const amt of testAmountsUsd) {
      const usdcIn = BigInt(amt) * 1000000n; // 6 decimals
      // LimitOrderBook._guardFloor: ideal = (amountIn * 10^8 * 10^stockDec) / (price * 10^quoteDec) = (amountIn * 10^10) / rawAnswer
      const idealStockOut = (usdcIn * 10000000000n) / rawAnswer;
      const actualStockOut = await quoteExactIn(USDC, m.address, usdcIn, m.fee);

      if (actualStockOut === 0n) {
        console.log(`$${String(amt).padStart(5)} | ${String(usdcIn).padStart(15)} | LIQUIDITY ERROR / NO QUOTE`);
        continue;
      }

      // Shortfall vs Oracle ideal
      const shortfallBps = Number(((idealStockOut - actualStockOut) * 10000n) / idealStockOut);
      const passes = shortfallBps <= m.configuredDeviationBps;

      console.log(
        `$${String(amt).padStart(5)} | ${String(usdcIn).padStart(15)} | ${String(Number(idealStockOut) / 1e8).padEnd(18)} | ${String(Number(actualStockOut) / 1e8).padEnd(16)} | ${String(shortfallBps).padStart(10)} bps | ${passes ? "PASS" : "FAIL (REVERTS)"}`
      );
    }

    console.log(`\n[SELLS: Stock -> USDC] (amountIn in Stock units calculated at oracle price, out in USDC)`);
    console.log(`USD Val | Stock In (units) | Oracle Ideal USDC  | Actual USDC Out  | Shortfall Bps | Passes Guard?`);
    console.log(`--------+------------------+--------------------+------------------+---------------+--------------`);

    for (const amt of testAmountsUsd) {
      // Calculate distinct stockIn for each amt ($25, $50, $100)
      const stockIn = (BigInt(amt) * 1000000n * 10000000000n) / rawAnswer;
      // LimitOrderBook._guardFloor: ideal = (stockIn * price * 10^quoteDec) / (10^stockDec * 10^8) = (stockIn * rawAnswer) / 10^10
      const idealUsdcOut = (stockIn * rawAnswer) / 10000000000n;
      const actualUsdcOut = await quoteExactIn(m.address, USDC, stockIn, m.fee);

      if (actualUsdcOut === 0n) {
        console.log(`$${String(amt).padStart(6)} | ${String(stockIn).padStart(16)} | LIQUIDITY ERROR / NO QUOTE`);
        continue;
      }

      const shortfallBps = Number(((idealUsdcOut - actualUsdcOut) * 10000n) / idealUsdcOut);
      const passes = shortfallBps <= m.configuredDeviationBps;

      console.log(
        `$${String(amt).padStart(6)} | ${String(stockIn).padStart(16)} | ${String(Number(idealUsdcOut) / 1e6).padEnd(18)} | ${String(Number(actualUsdcOut) / 1e6).padEnd(16)} | ${String(shortfallBps).padStart(10)} bps | ${passes ? "PASS" : "FAIL (REVERTS)"}`
      );
    }
    console.log("\n");
  }
}

main().catch(console.error);
