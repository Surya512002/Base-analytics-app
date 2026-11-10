// TESTNET ONLY. Moves the mock price (and the mock pool rate) so you can trigger orders on purpose.
// Usage:
//   SYMBOL=mAAPL PRICE=350 npx hardhat run scripts/testnet-set-price.js --network baseSepolia
//   FEED=0x.. ADAPTER=0x.. STOCK=0x.. QUOTE=0x.. PRICE=85 npx hardhat run scripts/testnet-set-price.js --network baseSepolia
require("../shared/loadEnv");
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

async function main() {
  const net = await ethers.provider.getNetwork();
  if (Number(net.chainId) !== 84532 && Number(net.chainId) !== 31337) {
    throw new Error(`testnet-set-price must run on Base Sepolia (84532) or local hardhat (31337). Found chainId: ${net.chainId}`);
  }

  const priceStr = process.env.PRICE;
  if (!priceStr) throw new Error("Missing required PRICE environment variable (e.g. PRICE=345)");
  const priceVal = Number(priceStr);
  const p8 = BigInt(Math.round(priceVal * 1e8));

  let feedAddr = process.env.FEED;
  let adapterAddr = process.env.ADAPTER;
  let stockAddr = process.env.STOCK;
  let quoteAddr = process.env.QUOTE;
  let stockDecimals = process.env.STOCK_DECIMALS ? Number(process.env.STOCK_DECIMALS) : null;
  let quoteDecimals = process.env.QUOTE_DECIMALS ? Number(process.env.QUOTE_DECIMALS) : 6;
  const symbol = process.env.SYMBOL;

  // Resolve from sepoliaDeployment.json if SYMBOL or addresses missing
  const depPath = path.resolve(__dirname, "../../src/config/sepoliaDeployment.json");
  if (fs.existsSync(depPath)) {
    const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));
    adapterAddr = adapterAddr || dep.swapAdapter;
    quoteAddr = quoteAddr || dep.quoteToken.address;
    quoteDecimals = quoteDecimals ?? dep.quoteToken.decimals;

    if (symbol) {
      const target = dep.markets.find((m) => m.symbol.toLowerCase() === symbol.toLowerCase());
      if (!target) {
        throw new Error(`Symbol '${symbol}' not found in sepoliaDeployment.json. Available: ${dep.markets.map((m) => m.symbol).join(", ")}`);
      }
      stockAddr = target.stockToken;
      feedAddr = target.feed;
      stockDecimals = target.decimals;
    }
  }

  if (!feedAddr || !adapterAddr || !stockAddr || !quoteAddr) {
    throw new Error("Missing market parameters. Provide SYMBOL=<symbol> or FEED, ADAPTER, STOCK, and QUOTE env vars.");
  }

  if (stockDecimals === null) {
    const erc20 = await ethers.getContractAt("MockERC20", stockAddr);
    stockDecimals = Number(await erc20.decimals());
  }

  console.log(`Setting price for ${symbol || stockAddr} on ${network.name}:`);
  console.log(`  Target Price:    $${priceVal} (${p8} 8-dec)`);
  console.log(`  Feed Address:    ${feedAddr}`);
  console.log(`  Stock Address:   ${stockAddr} (${stockDecimals} decimals)`);
  console.log(`  Quote Address:   ${quoteAddr} (${quoteDecimals} decimals)`);
  console.log(`  Adapter Address: ${adapterAddr}`);

  const feed = await ethers.getContractAt("MockFeed", feedAddr);
  const adapter = await ethers.getContractAt("MockAdapter", adapterAddr);

  // General rate formula:
  // sell: num = P8 * 10^quoteDecimals, den = 10^stockDecimals * 1e8
  // buy:  num = 10^stockDecimals * 1e8, den = P8 * 10^quoteDecimals
  const sellNum = p8 * (10n ** BigInt(quoteDecimals));
  const sellDen = (10n ** BigInt(stockDecimals)) * 100_000_000n;
  const buyNum = (10n ** BigInt(stockDecimals)) * 100_000_000n;
  const buyDen = p8 * (10n ** BigInt(quoteDecimals));

  console.log(`Updating adapter rates:`);
  console.log(`  Sell (stock -> quote): num=${sellNum}, den=${sellDen}`);
  const tx1 = await adapter.setRate(stockAddr, quoteAddr, sellNum, sellDen);
  await tx1.wait();

  console.log(`  Buy (quote -> stock): num=${buyNum}, den=${buyDen}`);
  const tx2 = await adapter.setRate(quoteAddr, stockAddr, buyNum, buyDen);
  await tx2.wait();

  console.log(`Updating oracle feed answer...`);
  const tx3 = await feed.setAnswer(p8);
  await tx3.wait();

  console.log(`Success: price for ${symbol || stockAddr} set to $${priceVal} on-chain!`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
