// limit-orders/scripts/live-8dec-smoke-test.js
require('../shared/loadEnv');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEPLOYMENT_PATH = path.resolve(ROOT_DIR, '../src/config/sepoliaDeployment.json');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

function loadArtifact(name) {
  const p = path.join(ROOT_DIR, 'artifacts/contracts', `${name}.sol`, `${name}.json`);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  const mockP = path.join(ROOT_DIR, 'artifacts/contracts/mocks/Mocks.sol', `${name}.json`);
  if (fs.existsSync(mockP)) return JSON.parse(fs.readFileSync(mockP, 'utf8'));
  throw new Error(`Artifact not found: ${name}`);
}

async function main() {
  console.log("=== Base Sepolia 8-Decimal Live Smoke Test (mAAPL) ===\n");

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
  const deployerPk = process.env.DEPLOYER_PK;
  const keeperPk = process.env.KEEPER_PK;

  if (!deployerPk || !keeperPk) {
    throw new Error("Missing DEPLOYER_PK or KEEPER_PK in limit-orders/.env");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // 1. Verify chainId === 84532
  const net = await provider.getNetwork();
  console.log(`Connected chain ID: ${net.chainId}`);
  if (Number(net.chainId) !== 84532) {
    throw new Error(`Must run on Base Sepolia (84532). Found: ${net.chainId}`);
  }

  const deployer = new ethers.Wallet(deployerPk, provider);
  const keeper = new ethers.Wallet(keeperPk, provider);
  console.log(`Trader / Deployer: ${deployer.address}`);
  console.log(`Keeper:            ${keeper.address}`);

  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, 'utf8'));
  const orderBookAddress = deployment.orderBook;
  const adapterAddress = deployment.swapAdapter;
  const quoteAddress = deployment.quoteToken.address;
  const quoteDecimals = deployment.quoteToken.decimals;

  const maapl = deployment.markets.find((m) => m.symbol === "mAAPL");
  if (!maapl) throw new Error("mAAPL market not found in sepoliaDeployment.json");
  const stockAddress = maapl.stockToken;
  const feedAddress = maapl.feed;
  const stockDecimals = maapl.decimals;

  console.log(`\nMarket Target: mAAPL`);
  console.log(`  Stock Address:   ${stockAddress} (${stockDecimals} decimals)`);
  console.log(`  Feed Address:    ${feedAddress}`);
  console.log(`  Quote Address:   ${quoteAddress} (${quoteDecimals} decimals)`);
  console.log(`  OrderBook:       ${orderBookAddress}`);
  console.log(`  Adapter:         ${adapterAddress}\n`);

  const orderBookArtifact = loadArtifact("LimitOrderBook");
  const mockErc20Artifact = loadArtifact("MockERC20");
  const mockFeedArtifact = loadArtifact("MockFeed");
  const mockAdapterArtifact = loadArtifact("MockAdapter");

  const bookDeployer = new ethers.Contract(orderBookAddress, orderBookArtifact.abi, deployer);
  const bookKeeper = new ethers.Contract(orderBookAddress, orderBookArtifact.abi, keeper);
  const quoteToken = new ethers.Contract(quoteAddress, mockErc20Artifact.abi, deployer);
  const stockToken = new ethers.Contract(stockAddress, mockErc20Artifact.abi, deployer);
  const feed = new ethers.Contract(feedAddress, mockFeedArtifact.abi, deployer);
  const adapter = new ethers.Contract(adapterAddress, mockAdapterArtifact.abi, deployer);

  // Helper to set price and adapter rates for 8-dec stock
  async function setPrice(priceUsd) {
    const p8 = BigInt(Math.round(priceUsd * 1e8));
    const sellNum = p8 * (10n ** BigInt(quoteDecimals));
    const sellDen = (10n ** BigInt(stockDecimals)) * 100_000_000n;
    const buyNum = (10n ** BigInt(stockDecimals)) * 100_000_000n;
    const buyDen = p8 * (10n ** BigInt(quoteDecimals));

    console.log(`Updating mAAPL price to $${priceUsd} on-chain...`);
    const tx1 = await adapter.setRate(stockAddress, quoteAddress, sellNum, sellDen);
    await tx1.wait();
    const tx2 = await adapter.setRate(quoteAddress, stockAddress, buyNum, buyDen);
    await tx2.wait();
    const tx3 = await feed.setAnswer(p8);
    await tx3.wait();
    console.log(`  Price set to $${priceUsd} (p8=${p8}). Feed & adapter updated.`);
  }

  // Step 1: Ensure initial price is $345.00
  await setPrice(345);

  // Step 2: Ensure trader has enough mUSDC
  const traderQuoteBal = await quoteToken.balanceOf(deployer.address);
  console.log(`Trader mUSDC Balance: ${ethers.formatUnits(traderQuoteBal, quoteDecimals)}`);
  if (traderQuoteBal < ethers.parseUnits("50", quoteDecimals)) {
    console.log("Minting 1,000 mUSDC to trader...");
    const txMint = await quoteToken.mint(deployer.address, ethers.parseUnits("1000", quoteDecimals));
    await txMint.wait();
  }

  // Step 3: Prepare Limit Buy order via calls.ts specification
  // Buy 0.10 mAAPL at $340 (when current price drops from $345 to <= $340)
  // Input: 34 mUSDC (34_000_000n)
  // Trigger: $340.00 (340_00000000n)
  // Expected out: (34 * 10^8) / 340 = 10_000_000n (0.10 mAAPL)
  // minAmountOut: 9_500_000n (0.095 mAAPL, ~5% slippage safety floor)
  const amountIn = 34_000_000n; // 34 mUSDC
  const triggerPrice = 340_00000000n; // $340.00 (8 dec)
  const minAmountOut = 9_500_000n; // 0.095 mAAPL (8 dec)
  const expiry = Math.floor(Date.now() / 1000) + 86400; // 24 hours

  console.log(`\n--- Step 3: Approving OrderBook for exact ${ethers.formatUnits(amountIn, quoteDecimals)} mUSDC ---`);
  const txApprove = await quoteToken.approve(orderBookAddress, amountIn);
  const rcApprove = await txApprove.wait();
  console.log(`Approve confirmed! Tx: ${rcApprove.hash}`);

  console.log(`\n--- Step 4: Creating LIMIT BUY order on OrderBook ---`);
  console.log(`  Amount In:     ${ethers.formatUnits(amountIn, quoteDecimals)} mUSDC`);
  console.log(`  Trigger Price: $${(Number(triggerPrice) / 1e8).toFixed(2)} (8 dec)`);
  console.log(`  Min Out:       ${ethers.formatUnits(minAmountOut, stockDecimals)} mAAPL (8 dec)`);

  const txOrder = await bookDeployer.createOrder(
    stockAddress,
    0, // OrderType.LIMIT_BUY
    amountIn,
    triggerPrice,
    minAmountOut,
    expiry
  );
  const rcOrder = await txOrder.wait();
  console.log(`createOrder confirmed! Tx: ${rcOrder.hash}`);

  // Find order ID from event or nextOrderId - 1
  const nextId = await bookDeployer.nextOrderId();
  const orderId = nextId - 1n;
  console.log(`Created Order ID: ${orderId}`);

  // Verify order details on-chain
  const orderOnChain = await bookDeployer.getOrder(orderId);
  console.log(`Order on-chain status: ${orderOnChain.status} (1 = OPEN)`);
  console.log(`Order owner:          ${orderOnChain.owner}`);
  console.log(`Order amountIn:       ${orderOnChain.amountIn}`);
  console.log(`Order triggerPrice:   ${orderOnChain.triggerPrice}`);

  // Step 5: Verify canExecute is false at $345
  const canExecBefore = await bookDeployer.canExecute(orderId);
  console.log(`canExecute(${orderId}) at $345.00: ${canExecBefore} (Expected: false)`);
  if (canExecBefore) throw new Error("Order should NOT be executable at $345 (trigger is $340)");

  // Step 6: Move price to $335.00 (below trigger $340.00)
  console.log(`\n--- Step 6: Moving price below trigger to $335.00 ---`);
  await setPrice(335);

  // Step 7: Verify canExecute is true at $335
  const canExecAfter = await bookDeployer.canExecute(orderId);
  console.log(`canExecute(${orderId}) at $335.00: ${canExecAfter} (Expected: true)`);
  if (!canExecAfter) throw new Error("Order SHOULD be executable at $335 (trigger is $340)");

  // Step 8: Keeper executes order
  console.log(`\n--- Step 8: Keeper executing order ${orderId} ---`);
  const initialStockBal = await stockToken.balanceOf(deployer.address);
  const initialKeeperStockBal = await stockToken.balanceOf(keeper.address);

  // Simulate first
  await bookKeeper.executeOrder.staticCall(orderId);
  console.log("Static call simulation passed successfully!");

  const txExec = await bookKeeper.executeOrder(orderId);
  const rcExec = await txExec.wait();
  console.log(`executeOrder confirmed! Tx: ${rcExec.hash}`);

  // Step 9: Verify final order status is EXECUTED (2)
  const orderAfter = await bookDeployer.getOrder(orderId);
  console.log(`Order ${orderId} final status: ${orderAfter.status} (2 = EXECUTED)`);
  if (Number(orderAfter.status) !== 2) throw new Error(`Expected status 2 (EXECUTED), found: ${orderAfter.status}`);

  // Balance changes
  const finalStockBal = await stockToken.balanceOf(deployer.address);
  const finalKeeperStockBal = await stockToken.balanceOf(keeper.address);
  const traderStockReceived = finalStockBal - initialStockBal;
  const keeperStockFee = finalKeeperStockBal - initialKeeperStockBal;

  console.log(`\n--- Execution Verification Results ---`);
  console.log(`Trader mAAPL received: ${ethers.formatUnits(traderStockReceived, stockDecimals)} mAAPL`);
  console.log(`Keeper mAAPL fee:      ${ethers.formatUnits(keeperStockFee, stockDecimals)} mAAPL`);
  console.log(`Total mAAPL produced:  ${ethers.formatUnits(traderStockReceived + keeperStockFee, stockDecimals)} mAAPL`);

  // Reset price back to standard $343
  console.log(`\nResetting mAAPL price to baseline $343.00...`);
  await setPrice(343);

  const logData = {
    test: "Base Sepolia 8-Decimal Live Smoke Test (mAAPL)",
    chainId: 84532,
    orderId: orderId.toString(),
    stockToken: stockAddress,
    stockDecimals,
    quoteToken: quoteAddress,
    quoteDecimals,
    amountInUsdc: ethers.formatUnits(amountIn, quoteDecimals),
    triggerPriceUsd: ethers.formatUnits(triggerPrice, 8),
    executionPriceUsd: "335.00",
    txApprove: rcApprove.hash,
    txCreateOrder: rcOrder.hash,
    txExecuteOrder: rcExec.hash,
    traderStockReceived: ethers.formatUnits(traderStockReceived, stockDecimals),
    keeperStockFee: ethers.formatUnits(keeperStockFee, stockDecimals),
    finalOrderStatus: "EXECUTED (2)",
    timestamp: new Date().toISOString(),
  };

  const logFilePath = path.join(LOGS_DIR, `sepolia-8dec-smoke-${Date.now()}.json`);
  fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2), 'utf8');
  const logHash = crypto.createHash("sha256").update(fs.readFileSync(logFilePath)).digest("hex");

  console.log(`\nLog written to: ${logFilePath}`);
  console.log(`Log SHA-256:   ${logHash}`);
  console.log("\n=== Live 8-Decimal Smoke Test PASSED! ===");
}

main().catch((err) => {
  console.error("FATAL ERROR in live smoke test:", err);
  process.exit(1);
});
