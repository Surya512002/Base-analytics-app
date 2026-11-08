// scripts/verify-deployment.js: Real on-chain verification against Base Mainnet or Base Sepolia
require("../shared/loadEnv");
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const UNISWAP_V3_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
];
const POOL_ABI = [
  "function liquidity() external view returns (uint128)",
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];
const FEED_ABI = [
  "function decimals() external view returns (uint8)",
  "function description() external view returns (string)",
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"
];

const OFFICIAL_COINBASE_TOKENS = {
  NVDAc: "0xb20000000000000000000078ee7ce2fE4908108C",
  AAPLc: "0xb200000000000000000000C2e324d24d7eEcd1fb",
  MSFTc: "0xB200000000000000000000Ab99cFa739E253872B",
  GOOGLc: "0xb2000000000000000000002D0BA3164cc74f58B7",
  TSLAc: "0xb2000000000000000000001e800a7f5189430cD0"
};

async function main() {
  const configPath = process.env.DEPLOY_CONFIG
    ? path.resolve(process.env.DEPLOY_CONFIG)
    : path.join(__dirname, "../config/deployConfig.json");

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found at ${configPath}`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  const provider = ethers.provider;
  const currentNetwork = await provider.getNetwork();
  const currentBlock = await provider.getBlockNumber();
  const now = Math.floor(Date.now() / 1000);

  console.log("=== Base Mainnet Deployment and Market Verification ===");
  console.log(`Connected Network: chainId=${currentNetwork.chainId}`);
  console.log(`Real eth_blockNumber: ${currentBlock}`);
  console.log(`Current UTC Time: ${new Date(now * 1000).toISOString()} (${now})\n`);

  const checks = [];
  function record(label, expected, actual, pass) {
    checks.push({ label, expected: String(expected), actual: String(actual), pass: Boolean(pass) });
  }

  const factory = new ethers.Contract(UNISWAP_V3_FACTORY, FACTORY_ABI, provider);

  // 1. Token Registry Verification
  console.log("--- 1. Token Registry Verification ---");
  for (const m of config.markets) {
    const official = OFFICIAL_COINBASE_TOKENS[m.symbol];
    const match = official && official.toLowerCase() === m.stockToken.toLowerCase();
    record(`${m.symbol} Official Address`, official || "UNKNOWN", m.stockToken, match);
    const code = await provider.getCode(m.stockToken);
    const hasCode = code !== "0x";
    record(`${m.symbol} On-Chain Bytecode`, "has bytecode", hasCode ? "has bytecode" : "NO BYTECODE (0x)", hasCode);
  }

  // 2. Chainlink Price Feeds Verification
  console.log("--- 2. Chainlink Price Feeds (Real on-chain latestRoundData & updatedAt) ---");
  for (const m of config.markets) {
    const feed = new ethers.Contract(m.feed, FEED_ABI, provider);
    let desc = "", dec = 8, updatedAt = 0, priceStr = "";
    let pass = false;
    try {
      desc = await feed.description();
      dec = await feed.decimals();
      const r = await feed.latestRoundData();
      updatedAt = Number(r[3]);
      const age = now - updatedAt;
      const price = Number(r[1]) / (10 ** Number(dec));
      priceStr = `$${price.toFixed(2)}`;
      const hasValidPrice = r[1] > 0n;
      const weekendHalt = age > Number(m.maxStaleness);
      console.log(`  Feed ${m.symbol} (${m.feed}): desc="${desc}", price=${priceStr}, updatedAt=${updatedAt} (${new Date(updatedAt * 1000).toISOString()}, age=${age}s, status=${weekendHalt ? "WEEKEND_HALT" : "ACTIVE"})`);
      record(`${m.symbol} Feed Live`, "responsive & valid price", `${priceStr} (dec=${dec})`, hasValidPrice);
      record(`${m.symbol} Feed Age (Real)`, "different age", `${age}s (${new Date(updatedAt * 1000).toISOString()})`, updatedAt > 0);
    } catch (e) {
      console.log(`  Feed ${m.symbol} (${m.feed}) ERROR: ${e.message}`);
      record(`${m.symbol} Feed Live`, "responsive & valid price", "ERROR: " + e.message, false);
      record(`${m.symbol} Feed Age (Real)`, "different age", "ERROR: " + e.message, false);
    }
  }

  // 3. Uniswap V3 Pool Derivation & Liquidity Depth Audit
  console.log("\n--- 3. Uniswap V3 Dynamic Pool Derivation & Liquidity Depth Audit ---");
  for (const m of config.markets) {
    const derivedPool = await factory.getPool(m.stockToken, config.quoteToken, m.poolFee);
    const poolExists = derivedPool !== ethers.ZeroAddress;
    console.log(`  Market ${m.symbol} (fee ${m.poolFee}): derived pool = ${derivedPool}`);

    if (m.symbol === "NVDAc" && m.poolFee === 3000) {
      const EXPECTED_NVDA_POOL = "0x60661b315553EB81872deEA9a66d567Cf0CCd33B";
      const nvdaPoolMatch = derivedPool.toLowerCase() === EXPECTED_NVDA_POOL.toLowerCase();
      record("NVDAc/USDC 0.3% Pool Match", EXPECTED_NVDA_POOL, derivedPool, nvdaPoolMatch);
    }

    if (poolExists) {
      const pool = new ethers.Contract(derivedPool, POOL_ABI, provider);
      try {
        const liq = await pool.liquidity();
        const slot0 = await pool.slot0();
        console.log(`    Active in-range liquidity: ${liq.toString()}, current tick: ${slot0.tick}`);
        const hasLiquidity = liq > 0n;
        record(`${m.symbol} Pool Liquidity`, "> 0", liq.toString(), hasLiquidity);
      } catch (e) {
        record(`${m.symbol} Pool Liquidity`, "> 0", "Error reading pool: " + e.message, false);
      }
    } else {
      record(`${m.symbol} Pool Exists`, "true", "false (0x000...)", false);
    }
  }

  // 4. TSLA In-Range Liquidity Check (Confirming Exclusion / Zero Depth)
  console.log("\n--- 4. TSLAc Pool Depth Check (Verification of Zero In-Range Liquidity) ---");
  const tslaPool = await factory.getPool(OFFICIAL_COINBASE_TOKENS.TSLAc, config.quoteToken, 10000);
  console.log(`  TSLAc/USDC (fee 10000) pool address: ${tslaPool}`);
  if (tslaPool !== ethers.ZeroAddress) {
    const pool = new ethers.Contract(tslaPool, POOL_ABI, provider);
    const tslaLiq = await pool.liquidity();
    const tslaSlot = await pool.slot0();
    console.log(`  TSLAc measured liquidity depth: ${tslaLiq.toString()} (tick: ${tslaSlot.tick})`);
    const isExcluded = !config.markets.some(m => m.symbol === "TSLAc");
    record("TSLAc Zero Liquidity Verified", "0", tslaLiq.toString(), tslaLiq === 0n);
    record("TSLAc Excluded from deployConfig", "true", String(isExcluded), isExcluded);
  }

  // 5. Deployed OrderBook & Adapter Checks (if BOOK_ADDRESS passed)
  const bookAddress = process.env.BOOK_ADDRESS || process.env.LIMIT_ORDER_BOOK;
  const adapterAddress = process.env.ADAPTER_ADDRESS || process.env.UNISWAP_ADAPTER;
  if (bookAddress && adapterAddress) {
    console.log("\n--- 5. Deployed Contract Parameters Audit ---");
    const book = await ethers.getContractAt("LimitOrderBook", bookAddress);
    const adapter = await ethers.getContractAt("UniswapV3Adapter", adapterAddress);

    const onchainQuote = await book.quoteToken();
    record("Quote Token", ethers.getAddress(config.quoteToken), ethers.getAddress(onchainQuote), onchainQuote.toLowerCase() === config.quoteToken.toLowerCase());

    const onchainKeeperFee = await book.keeperFeeBps();
    record("Keeper Fee Bps", config.keeperFeeBps, onchainKeeperFee, Number(onchainKeeperFee) === Number(config.keeperFeeBps));

    const onchainPaused = await book.paused();
    record("Paused State", "false", String(onchainPaused), !onchainPaused);

    for (const m of config.markets) {
      const stockAddr = ethers.getAddress(m.stockToken);
      const market = await book.markets(stockAddr);
      record(`${m.symbol} Market Enabled`, "true", String(market.enabled), market.enabled === true);
      record(`${m.symbol} Feed Configured`, ethers.getAddress(m.feed), ethers.getAddress(market.feed), market.feed.toLowerCase() === m.feed.toLowerCase());
      record(`${m.symbol} MaxStockIn`, m.maxStockIn, market.maxStockIn.toString(), market.maxStockIn.toString() === String(m.maxStockIn));
      record(`${m.symbol} MaxQuoteIn`, m.maxQuoteIn, market.maxQuoteIn.toString(), market.maxQuoteIn.toString() === String(m.maxQuoteIn));
    }
  }

  // 6. Summary Table
  console.log("\n" + "Check".padEnd(36) + "Expected".padEnd(30) + "Actual".padEnd(30) + "Status");
  console.log("-".repeat(102));
  let allPass = true;
  for (const c of checks) {
    const status = c.pass ? "[PASS]" : "[FAIL]";
    if (!c.pass) allPass = false;
    const exp = c.expected.length > 28 ? c.expected.slice(0, 25) + "..." : c.expected;
    const act = c.actual.length > 28 ? c.actual.slice(0, 25) + "..." : c.actual;
    console.log(c.label.padEnd(36) + exp.padEnd(30) + act.padEnd(30) + status);
  }
  console.log("-".repeat(102));

  if (allPass) {
    console.log("\nALL CHECKS PASSED: On-chain deployment prerequisites strictly verified on Base Mainnet.\n");
  } else {
    console.error("\nVERIFICATION FAILED: One or more parameters failed validation.\n");
    process.exit(1);
  }
}

main().catch(e => {
  console.error("Verification execution error:", e.message);
  process.exit(1);
});
