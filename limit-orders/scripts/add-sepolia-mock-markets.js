// limit-orders/scripts/add-sepolia-mock-markets.js
require('../shared/loadEnv');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEPLOYMENT_PATH = path.resolve(ROOT_DIR, '../src/config/sepoliaDeployment.json');

function loadArtifact(name) {
  const p = path.join(ROOT_DIR, 'artifacts/contracts', `${name}.sol`, `${name}.json`);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  const mockP = path.join(ROOT_DIR, 'artifacts/contracts/mocks/Mocks.sol', `${name}.json`);
  if (fs.existsSync(mockP)) return JSON.parse(fs.readFileSync(mockP, 'utf8'));
  throw new Error(`Artifact not found: ${name}`);
}

const NEW_MARKETS_SPEC = [
  {
    symbol: "mAAPL",
    name: "Mock Apple Inc (Testnet)",
    decimals: 8,
    priceUsd: 343,
    maxStockIn: 30_000_000n, // 0.30 mAAPL (~$102.90 cap)
    maxQuoteIn: 100_000_000n, // 100 mUSDC ($100 cap)
    category: "Testnet",
  },
  {
    symbol: "mMSFT",
    name: "Mock Microsoft Corp (Testnet)",
    decimals: 8,
    priceUsd: 532,
    maxStockIn: 20_000_000n, // 0.20 mMSFT (~$106.40 cap)
    maxQuoteIn: 100_000_000n, // 100 mUSDC ($100 cap)
    category: "Testnet",
  },
  {
    symbol: "mGOOGL",
    name: "Mock Alphabet Inc (Testnet)",
    decimals: 8,
    priceUsd: 286,
    maxStockIn: 35_000_000n, // 0.35 mGOOGL (~$100.10 cap)
    maxQuoteIn: 100_000_000n, // 100 mUSDC ($100 cap)
    category: "Testnet",
  },
];

async function main() {
  console.log("=== Add Sepolia Mock Markets Suite ===\n");

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
  const deployerPk = process.env.DEPLOYER_PK;

  if (!deployerPk) {
    console.error("FAIL: Missing DEPLOYER_PK in environment.");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // 1. Verify chainId === 84532
  const net = await provider.getNetwork();
  console.log(`Connected network chain ID: ${net.chainId}`);
  if (Number(net.chainId) !== 84532) {
    console.error(`FAIL: add-sepolia-mock-markets must run on Base Sepolia (84532). Found: ${net.chainId}`);
    process.exit(1);
  }

  const deployer = new ethers.Wallet(deployerPk, provider);
  console.log(`Deployer address: ${deployer.address}`);

  const depBal = await provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(depBal)} ETH`);
  if (depBal < ethers.parseEther("0.005")) {
    console.error("FAIL: Deployer has insufficient ETH balance for deployment (< 0.005 ETH).");
    process.exit(1);
  }

  // Load deployment JSON
  if (!fs.existsSync(DEPLOYMENT_PATH)) {
    console.error(`FAIL: Deployment file not found at ${DEPLOYMENT_PATH}`);
    process.exit(1);
  }
  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, "utf8"));
  const orderBookAddress = deployment.orderBook;
  const adapterAddress = deployment.swapAdapter;
  const quoteAddress = deployment.quoteToken.address;
  const quoteDecimals = deployment.quoteToken.decimals;

  console.log(`OrderBook:    ${orderBookAddress}`);
  console.log(`SwapAdapter:  ${adapterAddress}`);
  console.log(`QuoteToken:   ${quoteAddress} (${deployment.quoteToken.symbol}, ${quoteDecimals} dec)\n`);

  // Load artifacts
  const orderBookArtifact = loadArtifact("LimitOrderBook");
  const mockErc20Artifact = loadArtifact("MockERC20");
  const mockFeedArtifact = loadArtifact("MockFeed");
  const mockAdapterArtifact = loadArtifact("MockAdapter");

  const book = new ethers.Contract(orderBookAddress, orderBookArtifact.abi, deployer);
  const adapter = new ethers.Contract(adapterAddress, mockAdapterArtifact.abi, deployer);
  const quote = new ethers.Contract(quoteAddress, mockErc20Artifact.abi, deployer);

  // 2. Verify book.owner() === deployer.address
  const owner = await book.owner();
  console.log(`OrderBook contract owner: ${owner}`);
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error(`FAIL: Deployer (${deployer.address}) is not the owner of OrderBook (${owner}).`);
    process.exit(1);
  }
  console.log("Confirmed: Deployer is OrderBook owner.\n");

  const marketsMap = new Map();
  for (const m of deployment.markets) {
    marketsMap.set(m.symbol, m);
  }

  for (const spec of NEW_MARKETS_SPEC) {
    console.log(`--- Processing market: ${spec.symbol} (${spec.name}) ---`);

    let existing = marketsMap.get(spec.symbol);
    if (existing) {
      try {
        const mInfo = await book.markets(existing.stockToken);
        if (mInfo.enabled) {
          console.log(`Idempotent check: Market ${spec.symbol} already enabled on OrderBook at ${existing.stockToken}. Skipping deployment.`);
          continue;
        }
      } catch (err) {
        console.log(`Querying existing market info returned: ${err.message}. Proceeding to configure.`);
      }
    }

    const price8 = BigInt(Math.round(spec.priceUsd * 1e8));

    // A. Deploy MockERC20
    console.log(`Deploying MockERC20 ${spec.symbol} with ${spec.decimals} decimals...`);
    const erc20Factory = new ethers.ContractFactory(mockErc20Artifact.abi, mockErc20Artifact.bytecode, deployer);
    const stockContract = await erc20Factory.deploy(spec.name, spec.symbol, spec.decimals);
    await stockContract.waitForDeployment();
    const stockAddress = await stockContract.getAddress();
    const txStockDeploy = stockContract.deploymentTransaction();
    console.log(`MockERC20 ${spec.symbol} deployed at: ${stockAddress}`);
    console.log(`Deployment Tx: ${txStockDeploy?.hash}`);

    // B. Deploy MockFeed
    console.log(`Deploying MockFeed for ${spec.symbol} with initial price $${spec.priceUsd} (${price8})...`);
    const feedFactory = new ethers.ContractFactory(mockFeedArtifact.abi, mockFeedArtifact.bytecode, deployer);
    const feedContract = await feedFactory.deploy(price8);
    await feedContract.waitForDeployment();
    const feedAddress = await feedContract.getAddress();
    const txFeedDeploy = feedContract.deploymentTransaction();
    console.log(`MockFeed ${spec.symbol} deployed at: ${feedAddress}`);
    console.log(`Deployment Tx: ${txFeedDeploy?.hash}`);

    // C. Call book.setMarket(stock, feed, 604800, adapter, maxStockIn, maxQuoteIn, 500, true)
    console.log(`Setting market on OrderBook for ${spec.symbol}...`);
    const txSetMarket = await book.setMarket(
      stockAddress,
      feedAddress,
      604800, // 7 days max staleness
      adapterAddress,
      spec.maxStockIn,
      spec.maxQuoteIn,
      500, // 500 bps (5%) max deviation
      true
    );
    const rcSetMarket = await txSetMarket.wait();
    console.log(`OrderBook.setMarket confirmed! Tx: ${rcSetMarket.hash}`);

    // D. Mint stock inventory to adapter (100,000 whole stocks)
    const stockMintAmt = 100_000n * (10n ** BigInt(spec.decimals));
    console.log(`Minting ${ethers.formatUnits(stockMintAmt, spec.decimals)} ${spec.symbol} to adapter (${adapterAddress})...`);
    const txMintStock = await stockContract.mint(adapterAddress, stockMintAmt);
    const rcMintStock = await txMintStock.wait();
    console.log(`Stock mint confirmed! Tx: ${rcMintStock.hash}`);

    // E. Mint mUSDC inventory to adapter (500,000 mUSDC)
    const quoteMintAmt = 500_000n * (10n ** BigInt(quoteDecimals));
    console.log(`Minting ${ethers.formatUnits(quoteMintAmt, quoteDecimals)} mUSDC to adapter...`);
    const txMintQuote = await quote.mint(adapterAddress, quoteMintAmt);
    const rcMintQuote = await txMintQuote.wait();
    console.log(`Quote mint confirmed! Tx: ${rcMintQuote.hash}`);

    // F. Set adapter rates using general formula:
    // sell: num = P8 * 10^quoteDecimals, den = 10^stockDecimals * 1e8
    // buy:  num = 10^stockDecimals * 1e8, den = P8 * 10^quoteDecimals
    const sellNum = price8 * (10n ** BigInt(quoteDecimals));
    const sellDen = (10n ** BigInt(spec.decimals)) * 100_000_000n;
    const buyNum = (10n ** BigInt(spec.decimals)) * 100_000_000n;
    const buyDen = price8 * (10n ** BigInt(quoteDecimals));

    console.log(`Setting adapter rates for ${spec.symbol} <-> mUSDC...`);
    console.log(`  Sell Rate (${spec.symbol} -> mUSDC): num=${sellNum}, den=${sellDen}`);
    const txSellRate = await adapter.setRate(stockAddress, quoteAddress, sellNum, sellDen);
    const rcSellRate = await txSellRate.wait();
    console.log(`  Sell rate set! Tx: ${rcSellRate.hash}`);

    console.log(`  Buy Rate (mUSDC -> ${spec.symbol}): num=${buyNum}, den=${buyDen}`);
    const txBuyRate = await adapter.setRate(quoteAddress, stockAddress, buyNum, buyDen);
    const rcBuyRate = await txBuyRate.wait();
    console.log(`  Buy rate set! Tx: ${rcBuyRate.hash}`);

    // G. Store in markets map
    marketsMap.set(spec.symbol, {
      symbol: spec.symbol,
      name: spec.name,
      stockToken: stockAddress,
      decimals: spec.decimals,
      feed: feedAddress,
      poolFee: 3000,
      maxStalenessSeconds: 604800,
      maxStockIn: spec.maxStockIn.toString(),
      maxQuoteIn: spec.maxQuoteIn.toString(),
      category: spec.category,
    });

    console.log(`Market ${spec.symbol} configured successfully.\n`);
  }

  // Update deployment JSON
  deployment.markets = Array.from(marketsMap.values());
  fs.writeFileSync(DEPLOYMENT_PATH, JSON.stringify(deployment, null, 2) + "\n", "utf8");
  console.log(`Updated deployment config written to ${DEPLOYMENT_PATH}\n`);

  // Verify all markets on chain
  console.log("=== On-chain Verification of All Sepolia Markets ===");
  for (const m of deployment.markets) {
    const info = await book.markets(m.stockToken);
    const [price, timestamp] = await book.currentPrice(m.stockToken);
    console.log(`\nMarket: ${m.symbol}`);
    console.log(`  Stock Address:  ${m.stockToken} (${m.decimals} decimals)`);
    console.log(`  Feed Address:   ${info.feed} (feedDecimals: ${info.feedDecimals})`);
    console.log(`  Adapter:        ${info.adapter}`);
    console.log(`  Enabled:        ${info.enabled}`);
    console.log(`  Max Stock In:   ${info.maxStockIn}`);
    console.log(`  Max Quote In:   ${info.maxQuoteIn}`);
    console.log(`  Max Dev Bps:    ${info.maxDeviationBps}`);
    console.log(`  Current Price:  $${(Number(price) / 1e8).toFixed(2)} (${price.toString()} at ${timestamp})`);
  }

  console.log("\n=== Sepolia Mock Markets Setup Complete ===");
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
