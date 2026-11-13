// Print 4 Sepolia mock market configurations and current prices from the OrderBook on Base Sepolia
const fs = require("fs");
const path = require("path");
const { formatUnits } = require("viem");

const DEFAULT_DEPLOYMENT = {
  chainId: 84532,
  orderBook: "0xC7fBA8EB5442760F83266C32F3Bc2E5c65079e46",
  swapAdapter: "0xbDa98551b18431bD95fdF21D06cBc37dA9dE943D",
  quoteToken: {
    address: "0x19468e9fe5dBfdbD786D9b09Da7caC07c1367187",
    symbol: "mUSDC",
    decimals: 6,
  },
  markets: [
    {
      symbol: "mNVDA",
      name: "Mock NVDA (Testnet)",
      stockToken: "0xCCc66590BA8a67fe51bC2eB552B24f30c30263F2",
      decimals: 18,
      feed: "0x8836DF0Aa5F499B8E53649e6662EBE1C668F767f",
    },
    {
      symbol: "mAAPL",
      name: "Mock Apple Inc (Testnet)",
      stockToken: "0xeA43d6436f1a6ea337cF2e683D849370c7E34a47",
      decimals: 8,
      feed: "0x788B4d1737aeC2cFd0Af5F21f6F3D4C3CabCC41A",
    },
    {
      symbol: "mMSFT",
      name: "Mock Microsoft Corp (Testnet)",
      stockToken: "0xD36f172a140F7055cCC52C5c79719687374113c4",
      decimals: 8,
      feed: "0x05112FEa2F1755Da8786f8E8A461541E04f5947a",
    },
    {
      symbol: "mGOOGL",
      name: "Mock Alphabet Inc (Testnet)",
      stockToken: "0xC6185FA052550F8806483f236911A7a47EEEE0Ea",
      decimals: 8,
      feed: "0xd0980DE134C2676dD0F711447B9Bb09CB3A10125",
    },
  ],
};

function getDeployment() {
  const depPath = path.resolve(__dirname, "../../src/config/sepoliaDeployment.json");
  if (fs.existsSync(depPath)) {
    return JSON.parse(fs.readFileSync(depPath, "utf8"));
  }
  return DEFAULT_DEPLOYMENT;
}

// Exportable helper for testing market formatting
function formatMarketConfig(marketOnChain, m, quoteToken, round, feedDecimals) {
  const priceFormatted = Number(round.answer) / 10 ** Number(feedDecimals);
  return {
    symbol: m.symbol,
    name: m.name,
    stockToken: m.stockToken,
    feed: marketOnChain.feed,
    feedDecimals: Number(marketOnChain.feedDecimals),
    stockDecimals: Number(marketOnChain.stockDecimals),
    enabled: marketOnChain.enabled,
    currentPrice: priceFormatted,
    rawPrice: round.answer.toString(),
    maxStaleness: Number(marketOnChain.maxStaleness),
    maxDeviationBps: Number(marketOnChain.maxDeviationBps),
    adapter: marketOnChain.adapter,
    maxStockIn: formatUnits(BigInt(marketOnChain.maxStockIn), m.decimals),
    maxQuoteIn: formatUnits(BigInt(marketOnChain.maxQuoteIn), quoteToken.decimals),
  };
}

async function main() {
  require("../shared/loadEnv");
  const { ethers } = require("hardhat");
  const net = await ethers.provider.getNetwork();
  if (Number(net.chainId) !== 84532 && Number(net.chainId) !== 31337) {
    throw new Error(`Must run on Base Sepolia (84532). Found chainId: ${net.chainId}`);
  }

  const dep = getDeployment();

  // Correct 9-field tuple ABI matching LimitOrderBook.sol struct Market
  const orderBookAbi = [
    "function markets(address) external view returns (address feed, uint8 feedDecimals, uint8 stockDecimals, bool enabled, uint32 maxStaleness, uint16 maxDeviationBps, address adapter, uint128 maxStockIn, uint128 maxQuoteIn)",
    "function paused() external view returns (bool)",
    "function keeperFeeBps() external view returns (uint16)",
  ];
  const feedAbi = [
    "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
    "function decimals() external view returns (uint8)",
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

    const formatted = formatMarketConfig(marketOnChain, m, dep.quoteToken, round, feedDecimals);

    console.log(`\nMarket Symbol:       ${formatted.symbol} (${formatted.name})`);
    console.log(`  Stock Token:       ${formatted.stockToken} (${formatted.stockDecimals} decimals)`);
    console.log(`  Oracle Feed:       ${formatted.feed} (${formatted.feedDecimals} decimals)`);
    console.log(`  Current Price:     $${formatted.currentPrice.toFixed(2)} (raw: ${formatted.rawPrice})`);
    console.log(`  Max Staleness:     ${formatted.maxStaleness} seconds`);
    console.log(`  Max Deviation:     ${formatted.maxDeviationBps} bps (${formatted.maxDeviationBps / 100}%)`);
    console.log(`  Swap Adapter:      ${formatted.adapter}`);
    console.log(`  Max Stock In:      ${formatted.maxStockIn} ${formatted.symbol}`);
    console.log(`  Max Quote In:      ${formatted.maxQuoteIn} ${dep.quoteToken.symbol}`);
    console.log(`  Market Enabled:    ${formatted.enabled}`);
  }
  console.log(`\n===============================================================\n`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { formatMarketConfig, DEFAULT_DEPLOYMENT };
