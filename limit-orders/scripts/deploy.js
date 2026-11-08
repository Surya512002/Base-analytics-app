// Usage:
//   npx hardhat run scripts/deploy.js --network baseSepolia
//   npx hardhat run scripts/deploy.js --network base
//   DRY_RUN=1 npx hardhat run scripts/deploy.js
require("../shared/loadEnv");
const { ethers, network } = require("hardhat");
const path = require("path");
const fs = require("fs");
const { deployAll } = require("./deployLib");

function loadConfigFile() {
  const customPath = process.env.DEPLOY_CONFIG;
  const defaultPath = path.join(__dirname, "../config/deployConfig.json");
  const p = customPath ? path.resolve(customPath) : defaultPath;
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  }
  return null;
}

async function dryRunMock() {
  console.log("--- Starting dry run on in-process Hardhat network with mocks ---");
  const P = (n) => BigInt(Math.round(Number(n) * 1e8));

  // Deploy Mock USDC & Mock Router
  const ERC = await ethers.getContractFactory("MockERC20");
  const mockUsdc = await ERC.deploy("Mock USDC", "mUSDC", 6);
  const router = await (await ethers.getContractFactory("MockRouter02")).deploy();

  // Deploy mock stocks and feeds (mNVDA, mAAPL, mMSFT)
  const mockStocks = [
    { symbol: "mNVDA", price: 188, fee: 3000, stockCap: ethers.parseUnits("1", 18), quoteCap: ethers.parseUnits("100", 6) },
    { symbol: "mAAPL", price: 343, fee: 3000, stockCap: ethers.parseUnits("0.5", 18), quoteCap: ethers.parseUnits("100", 6) },
    { symbol: "mMSFT", price: 532, fee: 10000, stockCap: ethers.parseUnits("0.25", 18), quoteCap: ethers.parseUnits("100", 6) },
  ];

  const marketsConfig = [];
  for (const s of mockStocks) {
    const stock = await ERC.deploy(s.symbol, s.symbol, 18);
    const feed = await (await ethers.getContractFactory("MockFeed")).deploy(P(s.price));
    await stock.waitForDeployment();
    await feed.waitForDeployment();

    marketsConfig.push({
      symbol: s.symbol,
      stockToken: stock.target,
      feed: feed.target,
      poolFee: s.fee,
      maxStaleness: 90000,
      maxStockIn: s.stockCap.toString(),
      maxQuoteIn: s.quoteCap.toString(),
      maxDeviationBps: 300,
    });
  }

  const { book, adapter } = await deployAll({
    quoteToken: mockUsdc.target,
    router: router.target,
    keeperFeeBps: 10,
    markets: marketsConfig,
  });

  console.log("LimitOrderBook deployed to:", book.target);
  console.log("UniswapV3Adapter deployed to:", adapter.target);
  console.log(`Configured ${marketsConfig.length} markets successfully:`);
  for (const m of marketsConfig) {
    const market = await book.markets(m.stockToken);
    console.log(`  - Market ${m.symbol} (${m.stockToken}): enabled=${market.enabled}, adapter=${market.adapter}, maxStockIn=${market.maxStockIn}, maxQuoteIn=${market.maxQuoteIn}`);
  }
  console.log("--- Dry run complete: all contracts and markets wired successfully ---\n");
  return { book, adapter, markets: marketsConfig, mockUsdc, router };
}

async function main() {
  const isHardhatNetwork = network.name === "hardhat" || network.name === "localhost";
  const isDryRun = Boolean(process.env.DRY_RUN || (isHardhatNetwork && !process.env.QUOTE_TOKEN && !process.env.DEPLOY_CONFIG));

  if (isDryRun) {
    return await dryRunMock();
  }

  const currentNetwork = await ethers.provider.getNetwork();
  if (currentNetwork.chainId === 8453n || currentNetwork.chainId === 8453) {
    const [deployer] = await ethers.getSigners();
    const owner = process.env.OWNER_ADDRESS;
    if (!owner) {
      throw new Error("Refusing to deploy to Base mainnet (chainId 8453) without OWNER_ADDRESS set in env.");
    }
    if (owner.toLowerCase() === deployer.address.toLowerCase()) {
      throw new Error("Refusing to deploy to Base mainnet (chainId 8453) with OWNER_ADDRESS equal to deployer address.");
    }
    if (process.env.CONFIRM_MAINNET !== "yes") {
      throw new Error('Refusing to deploy to Base mainnet (chainId 8453) without CONFIRM_MAINNET="yes".');
    }
  }

  const fileConfig = loadConfigFile();
  const quoteToken = process.env.QUOTE_TOKEN || fileConfig?.quoteToken;
  const router = process.env.SWAP_ROUTER || fileConfig?.router;
  if (!quoteToken) throw new Error("Missing QUOTE_TOKEN in env or config file");
  if (!router) throw new Error("Missing SWAP_ROUTER in env or config file");

  let markets = fileConfig?.markets;
  if (!markets && process.env.STOCK_TOKEN && process.env.PRICE_FEED) {
    markets = [
      {
        symbol: process.env.STOCK_SYMBOL || "STOCK",
        stockToken: process.env.STOCK_TOKEN,
        feed: process.env.PRICE_FEED,
        poolFee: Number(process.env.POOL_FEE || 3000),
        maxStaleness: Number(process.env.MAX_STALENESS_SECONDS || 90000),
        maxStockIn: ethers.parseUnits(process.env.MAX_STOCK_IN || "1", Number(process.env.STOCK_DECIMALS || 18)).toString(),
        maxQuoteIn: ethers.parseUnits(process.env.MAX_QUOTE_IN || "100", Number(process.env.QUOTE_DECIMALS || 6)).toString(),
        maxDeviationBps: Number(process.env.MAX_DEVIATION_BPS || 300),
      },
    ];
  }

  if (!markets || markets.length === 0) {
    throw new Error("No markets configured to deploy");
  }

  console.log(`Deploying with ${markets.length} configured markets...`);
  const { book, adapter } = await deployAll({
    quoteToken: ethers.getAddress(quoteToken),
    router: ethers.getAddress(router),
    keeperFeeBps: Number(process.env.KEEPER_FEE_BPS || fileConfig?.keeperFeeBps || 10),
    maxDeviationBps: Number(process.env.MAX_DEVIATION_BPS || fileConfig?.maxDeviationBps || 300),
    owner: process.env.OWNER_ADDRESS || fileConfig?.owner,
    markets,
  });

  console.log("LimitOrderBook:", book.target);
  console.log("UniswapV3Adapter:", adapter.target);
  console.log("Configured markets:", markets.map((m) => m.symbol).join(", "));
  return { book, adapter };
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { main, dryRunMock };
