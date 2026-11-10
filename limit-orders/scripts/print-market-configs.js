// Print 4 Sepolia mock market configurations and current prices from the OrderBook on Base Sepolia
require("../shared/loadEnv");
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
  const net = await ethers.provider.getNetwork();
  if (Number(net.chainId) !== 84532 && Number(net.chainId) !== 31337) {
    throw new Error(`Must run on Base Sepolia (84532). Found chainId: ${net.chainId}`);
  }

  const depPath = path.resolve(__dirname, "../../src/config/sepoliaDeployment.json");
  const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));

  const orderBookAbi = [
    "function markets(address) external view returns (address feed, uint32 maxStaleness, address adapter, uint128 maxStockIn, uint128 maxQuoteIn, uint16 maxDeviationBps, bool enabled)",
    "function paused() external view returns (bool)",
    "function keeperFeeBps() external view returns (uint16)"
  ];
  const feedAbi = [
    "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
    "function decimals() external view returns (uint8)"
  ];

  const orderBook = new ethers.Contract(dep.orderBook, orderBookAbi, ethers.provider);
  const isPaused = await orderBook.paused();
  const feeBps = await orderBook.keeperFeeBps();

  console.log(`\n===============================================================`);
  console.log(`  BASE SEPOLIA LIMIT ORDER BOOK MARKET CONFIGURATIONS & PRICES `);
  console.log(`===============================================================`);
  console.log(`Chain ID:      ${net.chainId}`);
  console.log(`OrderBook:     ${dep.orderBook}`);
  console.log(`Paused:        ${isPaused}`);
  console.log(`Keeper Fee:    ${feeBps} bps (${Number(feeBps) / 100}%)`);
  console.log(`Quote Token:   ${dep.quoteToken.symbol} (${dep.quoteToken.address})`);
  console.log(`---------------------------------------------------------------`);

  for (const m of dep.markets) {
    const marketOnChain = await orderBook.markets(m.stockToken);
    const feed = new ethers.Contract(m.feed, feedAbi, ethers.provider);
    const round = await feed.latestRoundData();
    const feedDecimals = await feed.decimals();
    const priceFormatted = Number(round.answer) / 10 ** Number(feedDecimals);

    console.log(`\nMarket Symbol:       ${m.symbol} (${m.name})`);
    console.log(`  Stock Token:       ${m.stockToken} (${m.decimals} decimals)`);
    console.log(`  Oracle Feed:       ${marketOnChain.feed}`);
    console.log(`  Current Price:     $${priceFormatted.toFixed(2)} (raw: ${round.answer.toString()})`);
    console.log(`  Max Staleness:     ${marketOnChain.maxStaleness} seconds`);
    console.log(`  Max Deviation:     ${marketOnChain.maxDeviationBps} bps (${Number(marketOnChain.maxDeviationBps) / 100}%)`);
    console.log(`  Swap Adapter:      ${marketOnChain.adapter}`);
    console.log(`  Max Stock In:      ${ethers.formatUnits(marketOnChain.maxStockIn, m.decimals)} ${m.symbol}`);
    console.log(`  Max Quote In:      ${ethers.formatUnits(marketOnChain.maxQuoteIn, dep.quoteToken.decimals)} ${dep.quoteToken.symbol}`);
    console.log(`  Market Enabled:    ${marketOnChain.enabled}`);
  }
  console.log(`\n===============================================================\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
