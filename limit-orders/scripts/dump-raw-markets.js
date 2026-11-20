// Dump the raw 9-field markets(stock) tuple for each of the four mock stocks via eth_call on Base Sepolia
require("../shared/loadEnv");
const { ethers } = require("hardhat");

const ORDER_BOOK = "0xC7fBA8EB5442760F83266C32F3Bc2E5c65079e46";

const MARKETS = [
  { symbol: "mNVDA", name: "Mock NVDA (Testnet)", stockToken: "0xCCc66590BA8a67fe51bC2eB552B24f30c30263F2" },
  { symbol: "mAAPL", name: "Mock Apple Inc (Testnet)", stockToken: "0xeA43d6436f1a6ea337cF2e683D849370c7E34a47" },
  { symbol: "mMSFT", name: "Mock Microsoft Corp (Testnet)", stockToken: "0xD36f172a140F7055cCC52C5c79719687374113c4" },
  { symbol: "mGOOGL", name: "Mock Alphabet Inc (Testnet)", stockToken: "0xC6185FA052550F8806483f236911A7a47EEEE0Ea" },
];

async function main() {
  const net = await ethers.provider.getNetwork();
  console.log(`Connected network: ${net.name} (Chain ID: ${net.chainId})`);
  if (Number(net.chainId) !== 84532) {
    throw new Error(`Must run on Base Sepolia (84532). Found chainId: ${net.chainId}`);
  }

  const exactAbi = [
    "function markets(address) external view returns (address feed, uint8 feedDecimals, uint8 stockDecimals, bool enabled, uint32 maxStaleness, uint16 maxDeviationBps, address adapter, uint128 maxStockIn, uint128 maxQuoteIn)"
  ];

  const orderBook = new ethers.Contract(ORDER_BOOK, exactAbi, ethers.provider);

  console.log(`\n================================================================================`);
  console.log(` RAW ON-CHAIN MARKETS TUPLE DUMP (ALL 9 FIELDS BY ABI) ON BASE SEPOLIA`);
  console.log(` OrderBook Contract: ${ORDER_BOOK}`);
  console.log(`================================================================================\n`);

  for (const m of MARKETS) {
    const raw = await orderBook.markets(m.stockToken);
    console.log(`Market: ${m.symbol} (${m.name})`);
    console.log(`  Stock Token:        ${m.stockToken}`);
    console.log(`  [0] feed:           ${raw[0]} (named: ${raw.feed})`);
    console.log(`  [1] feedDecimals:   ${raw[1]} (named: ${raw.feedDecimals})`);
    console.log(`  [2] stockDecimals:  ${raw[2]} (named: ${raw.stockDecimals})`);
    console.log(`  [3] enabled:        ${raw[3]} (named: ${raw.enabled})`);
    console.log(`  [4] maxStaleness:   ${raw[4]} (named: ${raw.maxStaleness}) seconds`);
    console.log(`  [5] maxDeviationBps:${raw[5]} (named: ${raw.maxDeviationBps}) bps (${Number(raw[5])/100}%)`);
    console.log(`  [6] adapter:        ${raw[6]} (named: ${raw.adapter})`);
    console.log(`  [7] maxStockIn:     ${raw[7].toString()} (named: ${raw.maxStockIn.toString()}) raw units`);
    console.log(`  [8] maxQuoteIn:     ${raw[8].toString()} (named: ${raw.maxQuoteIn.toString()}) raw units`);
    console.log(`--------------------------------------------------------------------------------`);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { main };
