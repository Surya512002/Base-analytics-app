import { ethers } from "ethers";

const RPC_URL = process.env.BASE_FORK_RPC || "https://mainnet.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

const QUOTER_V2_ADDRESS = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
const FACTORY_ADDRESS = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const QUOTER_ABI = [
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
];
const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)",
];
const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
];
const FEED_ABI = [
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function getRoundData(uint80 _roundId) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() external view returns (uint8)",
];

const MARKETS = [
  { symbol: "NVDAc", token: ethers.getAddress("0xb20000000000000000000078ee7ce2fe4908108c"), feed: ethers.getAddress("0x04689a41629776563E6822F76f2e57D148d28513"), fee: 3000 },
  { symbol: "AAPLc", token: ethers.getAddress("0xb200000000000000000000c2e324d24d7eecd1fb"), feed: ethers.getAddress("0x787f13dEa48Db0897CbCDD985de77809D837F988"), fee: 3000 },
  { symbol: "MSFTc", token: ethers.getAddress("0xb200000000000000000000ab99cfa739e253872b"), feed: ethers.getAddress("0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c"), fee: 10000 },
  { symbol: "GOOGLc", token: ethers.getAddress("0xb2000000000000000000002d0ba3164cc74f58b7"), feed: ethers.getAddress("0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2"), fee: 3000 },
  { symbol: "TSLAc", token: ethers.getAddress("0xb2000000000000000000001e800a7f5189430cd0"), feed: ethers.getAddress("0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4"), fee: 10000 },
];

async function main() {
  const block = await provider.getBlock("latest");
  console.log(`=== BASE MAINNET STATE ===`);
  console.log(`Block Number: ${block.number}`);
  console.log(`Block Timestamp: ${block.timestamp} (${new Date(block.timestamp * 1000).toUTCString()})`);
  console.log(`Current Local Time: ${new Date().toUTCString()}\n`);

  const quoter = new ethers.Contract(QUOTER_V2_ADDRESS, QUOTER_ABI, provider);
  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

  console.log(`=== 1.4: RECONCILE PRICES (RAW LATEST ROUND DATA & POOL SLOT0) ===`);
  const marketDetails = {};

  for (const m of MARKETS.slice(0, 4)) {
    const feed = new ethers.Contract(m.feed, FEED_ABI, provider);
    const round = await feed.latestRoundData();
    const oraclePrice = Number(round.answer) / 1e8;
    const updatedAt = Number(round.updatedAt);
    const ageSeconds = block.timestamp - updatedAt;

    const poolAddr = await factory.getPool(m.token, USDC_ADDRESS, m.fee);
    const pool = new ethers.Contract(poolAddr, POOL_ABI, provider);
    const token0 = await pool.token0();
    const token1 = await pool.token1();
    const slot0 = await pool.slot0();

    // Uniswap price calculation
    // token0 and token1: if token0 is stock (18 or 8 decimals) and token1 is USDC (6 decimals)
    // stock tokens have 8 decimals (B20 standard).
    // sqrtPriceX96 = sqrt(price_token1 / price_token0) * 2^96
    const sqrtPrice = Number(slot0.sqrtPriceX96) / 2 ** 96;
    let poolPrice;
    if (token0.toLowerCase() === m.token.toLowerCase()) {
      // token0 = stock (8 dec), token1 = USDC (6 dec)
      // price_token1/price_token0 = (USDC_raw / 10^6) / (stock_raw / 10^8) = sqrtPrice^2 * 10^2
      poolPrice = (sqrtPrice ** 2) * (10 ** (8 - 6));
    } else {
      // token0 = USDC (6 dec), token1 = stock (8 dec)
      poolPrice = (1 / (sqrtPrice ** 2)) * (10 ** (8 - 6));
    }

    marketDetails[m.symbol] = {
      feed: m.feed,
      roundId: round.roundId.toString(),
      answer: round.answer.toString(),
      oraclePrice,
      updatedAt,
      ageSeconds,
      poolAddr,
      fee: m.fee,
      sqrtPriceX96: slot0.sqrtPriceX96.toString(),
      tick: slot0.tick,
      poolPrice,
    };

    console.log(`\nMarket: ${m.symbol}`);
    console.log(`  Feed: ${m.feed}`);
    console.log(`  raw latestRoundData: roundId=${round.roundId}, answer=${round.answer} ($${oraclePrice.toFixed(2)}), updatedAt=${updatedAt} (${ageSeconds}s ago)`);
    console.log(`  pool (${m.fee} bps): ${poolAddr}`);
    console.log(`  slot0: sqrtPriceX96=${slot0.sqrtPriceX96}, tick=${slot0.tick}, impliedPrice=$${poolPrice.toFixed(2)}`);
  }

  console.log(`\n=== 1.5: CORRECTED PRICE IMPACT TABLE (ACTUAL VS ORACLE-IDEAL GUARD FLOOR) ===`);
  const impactResults = [];

  for (const m of MARKETS.slice(0, 4)) {
    const details = marketDetails[m.symbol];
    const oraclePriceBig = BigInt(details.answer); // 8 decimals ($123.45 = 12345000000)

    for (const sizeUsd of [25, 50, 100]) {
      // --- BUY: Spend USDC, Receive Stock ---
      const quoteIn = BigInt(sizeUsd) * 1_000_000n; // 6 decimals
      // Contract guard ideal formula: ideal = (quoteIn * 10^8 * 10^8) / (price * 10^6) = (quoteIn * 10^10) / price
      const idealStockOut = (quoteIn * 10_000_000_000n) / oraclePriceBig;

      let actualStockOut = 0n;
      let buyError = null;
      try {
        const res = await quoter.quoteExactInputSingle.staticCall({
          tokenIn: USDC_ADDRESS,
          tokenOut: m.token,
          amountIn: quoteIn,
          fee: m.fee,
          sqrtPriceLimitX96: 0,
        });
        actualStockOut = res.amountOut;
      } catch (e) {
        buyError = e.message;
      }

      // Deviation = (ideal - actual) / ideal * 10000 (bps)
      // Positive deviation means user receives LESS than oracle ideal (cost/slippage)
      const buyDeviationBps = idealStockOut > 0n
        ? Number(((idealStockOut - actualStockOut) * 10_000n) / idealStockOut)
        : 0;

      impactResults.push({
        market: m.symbol,
        action: "BUY",
        sizeUsd,
        fee: m.fee,
        oraclePrice: details.oraclePrice,
        idealOut: ethers.formatUnits(idealStockOut, 8),
        actualOut: actualStockOut > 0n ? ethers.formatUnits(actualStockOut, 8) : "REVERT",
        deviationBps: buyDeviationBps,
        deviationPct: (buyDeviationBps / 100).toFixed(2) + "%",
        error: buyError,
      });

      // --- SELL: Spend Stock equivalent to sizeUsd, Receive USDC ---
      // stockIn = (quoteEquivalent * 10^10) / price
      const stockIn = (BigInt(sizeUsd) * 1_000_000n * 10_000_000_000n) / oraclePriceBig;
      // Contract guard ideal formula: ideal = (stockIn * price) / 10^10
      const idealQuoteOut = (stockIn * oraclePriceBig) / 10_000_000_000n;

      let actualQuoteOut = 0n;
      let sellError = null;
      try {
        const res = await quoter.quoteExactInputSingle.staticCall({
          tokenIn: m.token,
          tokenOut: USDC_ADDRESS,
          amountIn: stockIn,
          fee: m.fee,
          sqrtPriceLimitX96: 0,
        });
        actualQuoteOut = res.amountOut;
      } catch (e) {
        sellError = e.message;
      }

      const sellDeviationBps = idealQuoteOut > 0n
        ? Number(((idealQuoteOut - actualQuoteOut) * 10_000n) / idealQuoteOut)
        : 0;

      impactResults.push({
        market: m.symbol,
        action: "SELL",
        sizeUsd,
        fee: m.fee,
        oraclePrice: details.oraclePrice,
        idealOut: ethers.formatUnits(idealQuoteOut, 6),
        actualOut: actualQuoteOut > 0n ? ethers.formatUnits(actualQuoteOut, 6) : "REVERT",
        deviationBps: sellDeviationBps,
        deviationPct: (sellDeviationBps / 100).toFixed(2) + "%",
        error: sellError,
      });
    }
  }

  console.table(impactResults);

  console.log(`\n=== 1.6: CHAINLINK FEED EVIDENCE (LAST 30 ROUNDS) ===`);
  for (const m of MARKETS) {
    const feed = new ethers.Contract(m.feed, FEED_ABI, provider);
    const latest = await feed.latestRoundData();
    const latestRoundId = latest.roundId;

    console.log(`\n======================================================`);
    console.log(`Feed: ${m.symbol} (${m.feed})`);
    console.log(`Latest roundId: ${latestRoundId}`);
    console.log(`Latest answer: ${latest.answer} ($${(Number(latest.answer) / 1e8).toFixed(2)})`);
    console.log(`Latest updatedAt: ${latest.updatedAt} (${new Date(Number(latest.updatedAt) * 1000).toUTCString()})`);
    console.log(`Age right now: ${block.timestamp - Number(latest.updatedAt)}s (${((block.timestamp - Number(latest.updatedAt)) / 3600).toFixed(1)}h)`);
    console.log(`------------------------------------------------------`);
    console.log(`Round History (Last 30 rounds):`);

    // In EACAggregatorProxy, roundId is (phaseId << 64) | aggregatorRoundId
    // We can step backwards 30 aggregator rounds
    const rounds = [];
    let currentRoundId = latestRoundId;
    let prevUpdatedAt = null;

    for (let i = 0; i < 30; i++) {
      try {
        const r = await feed.getRoundData(currentRoundId);
        const rTime = Number(r.updatedAt);
        const gap = prevUpdatedAt !== null ? (prevUpdatedAt - rTime) : 0;
        rounds.push({
          roundId: r.roundId.toString(),
          price: (Number(r.answer) / 1e8).toFixed(2),
          updatedAtUTC: new Date(rTime * 1000).toISOString(),
          gapSeconds: gap,
          gapHours: (gap / 3600).toFixed(2),
        });
        prevUpdatedAt = rTime;
        currentRoundId = currentRoundId - 1n;
      } catch (e) {
        // Break if phase boundary reached
        break;
      }
    }

    console.table(rounds);

    // Summarize cadence
    const gaps = rounds.slice(1).map(r => r.gapSeconds);
    if (gaps.length > 0) {
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const minGap = Math.min(...gaps);
      const maxGap = Math.max(...gaps);
      console.log(`Cadence Summary for ${m.symbol}:`);
      console.log(`  Count of valid historical rounds: ${rounds.length}`);
      console.log(`  Average gap: ${avgGap.toFixed(0)}s (${(avgGap / 3600).toFixed(1)}h)`);
      console.log(`  Min gap: ${minGap}s (${(minGap / 60).toFixed(1)}m)`);
      console.log(`  Max gap: ${maxGap}s (${(maxGap / 3600).toFixed(1)}h)`);
    }
  }
}

main().catch(err => {
  console.error("FATAL ERROR in audit script:", err);
  process.exit(1);
});
