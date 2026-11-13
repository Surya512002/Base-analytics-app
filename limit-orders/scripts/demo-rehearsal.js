import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { ethers } from 'ethers';
import {
  buildApproveCall,
  buildCreateOrderCall,
  buildCreateTrailingStopCall,
  buildCreateBracketCall,
  buildUpdateOrderCall,
  buildCancelOrderCall,
  buildCreateDcaCall,
  buildCancelDcaCall,
} from '../../src/lib/limitOrders/calls';
import {
  expectedAmountOut,
  minAmountOut,
  parseTriggerPrice,
  trailingStopPrice,
} from '../../src/lib/limitOrders/orderMath';

// Load limit-orders/.env
const envPath = path.resolve('limit-orders/.env');
if (!fs.existsSync(envPath)) {
  console.error('Missing limit-orders/.env');
  process.exit(1);
}
const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
const env = {};
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq !== -1) {
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const rpcUrl = env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const deployerPk = env.DEPLOYER_PK;
const keeperPk = env.KEEPER_PK;

if (!deployerPk || !keeperPk) {
  console.error('Missing DEPLOYER_PK or KEEPER_PK in limit-orders/.env');
  process.exit(1);
}

const LOGS_DIR = path.resolve('limit-orders/logs');
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

const provider = new ethers.JsonRpcProvider(rpcUrl);

const orderBookAbi = [
  "function quoteToken() view returns (address)",
  "function quoteDecimals() view returns (uint8)",
  "function keeperFeeBps() view returns (uint16)",
  "function nextOrderId() view returns (uint256)",
  "function nextPlanId() view returns (uint256)",
  "function currentPrice(address stockToken) view returns (uint256 price, uint256 updatedAt)",
  "function getOrder(uint256 id) view returns ((address owner, uint40 expiry, uint8 orderType, uint8 status, uint16 trailBps, address stockToken, uint96 triggerPrice, uint128 amountIn, uint128 minAmountOut, uint96 peakPrice, uint64 linkedId))",
  "function getPlan(uint256 id) view returns ((address owner, uint8 status, uint16 remaining, uint32 interval, uint40 nextTime, address stockToken, uint96 maxPrice, uint128 amountPerBuy))",
  "event OrderCreated(uint256 indexed id, address indexed owner, address indexed stockToken, uint8 orderType, uint256 amountIn, uint256 triggerPrice, uint256 minAmountOut, uint40 expiry)",
  "event BracketCreated(uint256 indexed takeProfitId, uint256 indexed stopLossId)",
  "event OrderExecuted(uint256 indexed id, address indexed owner, address indexed keeper, uint256 price, uint256 amountIn, uint256 amountOutToOwner, uint256 keeperFee)",
  "event OrderCancelled(uint256 indexed id, address indexed owner)",
  "event DcaCreated(uint256 indexed id, address indexed owner, address indexed stockToken, uint256 amountPerBuy, uint16 buys, uint32 interval, uint96 maxPrice)",
  "event DcaExecuted(uint256 indexed id, address indexed owner, address indexed keeper, uint256 price, uint256 amountIn, uint256 stockToOwner, uint256 keeperFee, uint256 remaining)",
  "event DcaCancelled(uint256 indexed id, address indexed owner, uint256 refunded)",
  "event TrailUpdated(uint256 indexed id, uint256 peakPrice, uint256 stopPrice)"
];

const erc20Abi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function mint(address to, uint256 amount) external",
  "function approve(address spender, uint256 amount) external returns (bool)"
];

const feedAbi = [
  "function setAnswer(int256 a) external",
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)"
];

const adapterAbi = [
  "function setRate(address tIn, address tOut, uint256 n, uint256 d) external",
  "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) external returns (uint256 amountOut)"
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('===============================================================');
  console.log('PART 2.2: DEMO REHEARSAL ON LIVE BASE SEPOLIA');
  console.log('===============================================================');

  // 1. Verify chainId 84532
  const net = await provider.getNetwork();
  console.log(`Connected chainId: ${net.chainId}`);
  if (net.chainId !== 84532n) {
    throw new Error(`ABORT: Expected Base Sepolia chainId 84532, got ${net.chainId}`);
  }

  // 2. Read deployment config and verify orderBook
  const depPath = path.resolve('src/config/sepoliaDeployment.json');
  const dep = JSON.parse(fs.readFileSync(depPath, 'utf8'));
  const EXPECTED_BOOK = "0xC7fBA8EB5442760F83266C32F3Bc2E5c65079e46";
  if (dep.orderBook.toLowerCase() !== EXPECTED_BOOK.toLowerCase()) {
    throw new Error(`ABORT: orderBook mismatch. Expected ${EXPECTED_BOOK}, found ${dep.orderBook}`);
  }
  console.log(`OrderBook address verified: ${dep.orderBook}`);

  const orderBook = new ethers.Contract(dep.orderBook, orderBookAbi, provider);
  const quoteAddress = dep.quoteToken.address;
  const quoteDecimals = dep.quoteToken.decimals;
  const adapterAddress = dep.swapAdapter;

  const maaplTarget = dep.markets.find(m => m.symbol === 'mAAPL');
  const mnvdaTarget = dep.markets.find(m => m.symbol === 'mNVDA');
  if (!maaplTarget || !mnvdaTarget) throw new Error("Could not find mAAPL and mNVDA markets in config");

  const deployer = new ethers.Wallet(deployerPk, provider);
  const keeper = new ethers.Wallet(keeperPk, provider);
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Keeper address:   ${keeper.address}`);

  // 3. Create throwaway USER wallet (never print private key)
  const user = ethers.Wallet.createRandom().connect(provider);
  console.log(`User address:     ${user.address} (throwaway, key never printed)`);

  const results = {
    startedAt: new Date().toISOString(),
    network: 'Base Sepolia (84532)',
    orderBook: dep.orderBook,
    userAddress: user.address,
    steps: [],
    scenarios: {}
  };

  function logStep(name, txHash, details = {}) {
    const basescan = txHash ? `https://sepolia.basescan.org/tx/${txHash}` : null;
    const entry = { step: name, txHash, basescan, ...details, timestamp: new Date().toISOString() };
    results.steps.push(entry);
    console.log(`\n[STEP] ${name}`);
    if (basescan) console.log(`  Basescan: ${basescan}`);
    if (details.note) console.log(`  Note:     ${details.note}`);
    return entry;
  }

  // 4. Fund throwaway user with 0.004 ETH from deployer
  console.log('\n--- Funding throwaway user wallet ---');
  const fundTx = await deployer.sendTransaction({
    to: user.address,
    value: ethers.parseEther("0.004")
  });
  await fundTx.wait();
  logStep('Fund User Wallet with 0.004 ETH', fundTx.hash);

  // 5. Mint mock tokens for user
  console.log('\n--- Minting mock tokens to user ---');
  const quoteContract = new ethers.Contract(quoteAddress, erc20Abi, deployer);
  const maaplContract = new ethers.Contract(maaplTarget.stockToken, erc20Abi, deployer);
  const mnvdaContract = new ethers.Contract(mnvdaTarget.stockToken, erc20Abi, deployer);

  const mintUSDC = await quoteContract.mint(user.address, ethers.parseUnits("300", 6));
  await mintUSDC.wait();
  logStep('Mint 300 mUSDC to User', mintUSDC.hash);

  const mintAAPL = await maaplContract.mint(user.address, ethers.parseUnits("1.0", 8));
  await mintAAPL.wait();
  logStep('Mint 1.0 mAAPL to User', mintAAPL.hash);

  const mintNVDA = await mnvdaContract.mint(user.address, ethers.parseUnits("1.0", 18));
  await mintNVDA.wait();
  logStep('Mint 1.0 mNVDA to User', mintNVDA.hash);

  // Approve OrderBook from User using buildApproveCall from calls.ts
  console.log('\n--- Approving OrderBook for tokens from User ---');
  const userQuote = quoteContract.connect(user);
  const userAAPL = maaplContract.connect(user);
  const userNVDA = mnvdaContract.connect(user);

  const appUSDC = buildApproveCall(quoteAddress, dep.orderBook, ethers.parseUnits("300", 6));
  const txAppUSDC = await user.sendTransaction({ to: appUSDC.to, data: appUSDC.data });
  await txAppUSDC.wait();
  logStep('User approve mUSDC to OrderBook', txAppUSDC.hash);

  const appAAPL = buildApproveCall(maaplTarget.stockToken, dep.orderBook, ethers.parseUnits("1.0", 8));
  const txAppAAPL = await user.sendTransaction({ to: appAAPL.to, data: appAAPL.data });
  await txAppAAPL.wait();
  logStep('User approve mAAPL to OrderBook', txAppAAPL.hash);

  const appNVDA = buildApproveCall(mnvdaTarget.stockToken, dep.orderBook, ethers.parseUnits("1.0", 18));
  const txAppNVDA = await user.sendTransaction({ to: appNVDA.to, data: appNVDA.data });
  await txAppNVDA.wait();
  logStep('User approve mNVDA to OrderBook', txAppNVDA.hash);

  // 6. Start Keeper as child process
  console.log('\n--- Starting Keeper child process ---');
  const tsxCli = path.resolve('limit-orders/node_modules/tsx/dist/cli.mjs');
  const keeperProc = spawn(process.execPath, [tsxCli, 'keeper/keeper.ts'], {
    cwd: path.resolve('limit-orders'),
    env: {
      ...process.env,
      CHAIN: 'baseSepolia',
      RPC_URL: rpcUrl,
      ORDER_BOOK: dep.orderBook,
      POLL_MS: '3000',
      KEEPER_PK: keeperPk
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  keeperProc.stdout.on('data', d => process.stdout.write(`[KEEPER] ${d}`));
  keeperProc.stderr.on('data', d => process.stderr.write(`[KEEPER ERR] ${d}`));
  // wait 4s for keeper to boot
  await sleep(4000);

  // Price Setter Helper using testnet-set-price logic
  const adapterContract = new ethers.Contract(adapterAddress, adapterAbi, deployer);
  async function setMockPrice(market, priceUsd) {
    const p8 = BigInt(Math.round(priceUsd * 1e8));
    const sDec = market.decimals;
    const qDec = quoteDecimals;
    const sellNum = p8 * (10n ** BigInt(qDec));
    const sellDen = (10n ** BigInt(sDec)) * 100_000_000n;
    const buyNum = (10n ** BigInt(sDec)) * 100_000_000n;
    const buyDen = p8 * (10n ** BigInt(qDec));

    const feedContract = new ethers.Contract(market.feed, feedAbi, deployer);
    const tx1 = await adapterContract.setRate(market.stockToken, quoteAddress, sellNum, sellDen);
    await tx1.wait();
    const tx2 = await adapterContract.setRate(quoteAddress, market.stockToken, buyNum, buyDen);
    await tx2.wait();
    const tx3 = await feedContract.setAnswer(p8);
    await tx3.wait();
    console.log(`[PRICE] Set ${market.symbol} price to $${priceUsd} (tx: ${tx3.hash})`);
  }

  // Polling helper to wait for order execution / cancellation
  async function waitForOrderStatus(id, targetStatus, timeoutMs = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const o = await orderBook.getOrder(id);
      if (Number(o.status) === targetStatus) return o;
      await sleep(2000);
    }
    const finalOrder = await orderBook.getOrder(id);
    throw new Error(`Timeout waiting for order ${id} to reach status ${targetStatus} (current status: ${finalOrder.status})`);
  }

  // Polling helper to wait for DCA execution
  async function waitForDcaExecution(id, initialRemaining, timeoutMs = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const p = await orderBook.getPlan(id);
      if (Number(p.remaining) < initialRemaining) return p;
      await sleep(2000);
    }
    throw new Error(`Timeout waiting for plan ${id} execution`);
  }

  const orderBookUser = orderBook.connect(user);

  try {
    // =========================================================================
    // SCENARIO 1: Limit buy fill (mAAPL - 8 decimals)
    // =========================================================================
    console.log('\n===============================================================');
    console.log('SCENARIO 1: Limit Buy Fill (mAAPL - 8 decimals)');
    console.log('===============================================================');
    try {
      await setMockPrice(maaplTarget, 200); // Current price $200
      const amountIn = ethers.parseUnits("20", 6); // 20 mUSDC
      const triggerPrice = parseTriggerPrice("190"); // buy if price <= $190
      const expOut = expectedAmountOut("LIMIT_BUY", amountIn, triggerPrice, 8, 6);
      const minOut = minAmountOut(expOut, 100); // 1% slippage
      const expiry = Math.floor(Date.now() / 1000) + 86400;

      const orderTxData = buildCreateOrderCall({
        orderBook: dep.orderBook,
        stockToken: maaplTarget.stockToken,
        orderType: 0, // LIMIT_BUY
        amountIn,
        triggerPrice,
        minAmountOut: minOut,
        expiry
      });

      const nextIdBefore = await orderBook.nextOrderId();
      const tx = await user.sendTransaction({ to: orderTxData.to, data: orderTxData.data });
      const rc = await tx.wait();
      const orderId = nextIdBefore;
      logStep('S1: Create Limit Buy Order (mAAPL)', tx.hash, { orderId: orderId.toString(), trigger: '$190' });

      // Move price to $185 to trigger buy
      await setMockPrice(maaplTarget, 185);

      // Wait for keeper to execute (Status 2 = EXECUTED)
      console.log(`Waiting for keeper to execute order ${orderId}...`);
      const executedOrder = await waitForOrderStatus(orderId, 2);
      
      // Calculate math assertion
      const actualPriceP8 = BigInt(Math.round(185 * 1e8));
      const grossExp = expectedAmountOut("LIMIT_BUY", amountIn, actualPriceP8, 8, 6);
      const netExp = grossExp - (grossExp * 10n) / 10000n; // keeper fee 10 bps
      
      results.scenarios.scenario1 = {
        name: 'Limit buy fill (mAAPL - 8 decimals)',
        status: 'PASS',
        orderId: orderId.toString(),
        triggerPrice: '190',
        fillPrice: '185',
        expectedNetOut: netExp.toString(),
        minOut: minOut.toString()
      };
      console.log('S1: PASS - Order executed successfully!');
    } catch (e) {
      console.error('S1 FAIL:', e.message);
      results.scenarios.scenario1 = { status: 'FAIL', reason: e.message };
    }

    // =========================================================================
    // SCENARIO 2: Take-profit fill (mNVDA - 18 decimals)
    // =========================================================================
    console.log('\n===============================================================');
    console.log('SCENARIO 2: Take-Profit Fill (mNVDA - 18 decimals)');
    console.log('===============================================================');
    try {
      await setMockPrice(mnvdaTarget, 100); // Current price $100
      const amountIn = ethers.parseUnits("0.1", 18); // 0.1 mNVDA
      const triggerPrice = parseTriggerPrice("115"); // sell if price >= $115
      const expOut = expectedAmountOut("LIMIT_SELL", amountIn, triggerPrice, 18, 6);
      const minOut = minAmountOut(expOut, 100);
      const expiry = Math.floor(Date.now() / 1000) + 86400;

      const orderTxData = buildCreateOrderCall({
        orderBook: dep.orderBook,
        stockToken: mnvdaTarget.stockToken,
        orderType: 1, // LIMIT_SELL (Take-profit)
        amountIn,
        triggerPrice,
        minAmountOut: minOut,
        expiry
      });

      const nextIdBefore = await orderBook.nextOrderId();
      const tx = await user.sendTransaction({ to: orderTxData.to, data: orderTxData.data });
      await tx.wait();
      const orderId = nextIdBefore;
      logStep('S2: Create Take-Profit Order (mNVDA)', tx.hash, { orderId: orderId.toString(), trigger: '$115' });

      // Move price to $120 to trigger
      await setMockPrice(mnvdaTarget, 120);

      console.log(`Waiting for keeper to execute order ${orderId}...`);
      await waitForOrderStatus(orderId, 2);

      results.scenarios.scenario2 = {
        name: 'Take-profit fill (mNVDA - 18 decimals)',
        status: 'PASS',
        orderId: orderId.toString(),
        triggerPrice: '115',
        fillPrice: '120'
      };
      console.log('S2: PASS - Take-profit executed successfully!');
    } catch (e) {
      console.error('S2 FAIL:', e.message);
      results.scenarios.scenario2 = { status: 'FAIL', reason: e.message };
    }

    // =========================================================================
    // SCENARIO 3: Stop-loss fill (mAAPL - 8 decimals)
    // =========================================================================
    console.log('\n===============================================================');
    console.log('SCENARIO 3: Stop-Loss Fill (mAAPL - 8 decimals)');
    console.log('===============================================================');
    try {
      await setMockPrice(maaplTarget, 185); // Current price $185
      const amountIn = ethers.parseUnits("0.05", 8); // 0.05 mAAPL
      const triggerPrice = parseTriggerPrice("170"); // stop loss if price <= $170
      const expOut = expectedAmountOut("STOP_LOSS", amountIn, triggerPrice, 8, 6);
      const minOut = minAmountOut(expOut, 500); // 5% slippage to allow fill below trigger price
      const expiry = Math.floor(Date.now() / 1000) + 86400;

      const orderTxData = buildCreateOrderCall({
        orderBook: dep.orderBook,
        stockToken: maaplTarget.stockToken,
        orderType: 2, // STOP_LOSS
        amountIn,
        triggerPrice,
        minAmountOut: minOut,
        expiry
      });

      const nextIdBefore = await orderBook.nextOrderId();
      const tx = await user.sendTransaction({ to: orderTxData.to, data: orderTxData.data });
      await tx.wait();
      const orderId = nextIdBefore;
      logStep('S3: Create Stop-Loss Order (mAAPL)', tx.hash, { orderId: orderId.toString(), trigger: '$170' });

      // Move price down to $165 to trigger stop loss
      await setMockPrice(maaplTarget, 165);

      console.log(`Waiting for keeper to execute order ${orderId}...`);
      await waitForOrderStatus(orderId, 2);

      results.scenarios.scenario3 = {
        name: 'Stop-loss fill (mAAPL - 8 decimals)',
        status: 'PASS',
        orderId: orderId.toString(),
        triggerPrice: '170',
        fillPrice: '165'
      };
      console.log('S3: PASS - Stop-loss executed successfully!');
    } catch (e) {
      console.error('S3 FAIL:', e.message);
      results.scenarios.scenario3 = { status: 'FAIL', reason: e.message };
    }

    // =========================================================================
    // SCENARIO 4: Trailing stop raised then filled (mNVDA - 18 decimals)
    // =========================================================================
    console.log('\n===============================================================');
    console.log('SCENARIO 4: Trailing Stop Raised then Filled (mNVDA - 18 decimals)');
    console.log('===============================================================');
    try {
      await setMockPrice(mnvdaTarget, 120); // Current price $120
      const amountIn = ethers.parseUnits("0.1", 18);
      const trailBps = 500; // 5% trail
      const initialPeakP8 = parseTriggerPrice("120");
      const initialStopP8 = trailingStopPrice(initialPeakP8, trailBps); // $114
      const expOut = expectedAmountOut("TRAILING_STOP", amountIn, initialStopP8, 18, 6);
      const minOut = minAmountOut(expOut, 200); // 2% slippage
      const expiry = Math.floor(Date.now() / 1000) + 86400;

      const orderTxData = buildCreateTrailingStopCall({
        orderBook: dep.orderBook,
        stockToken: mnvdaTarget.stockToken,
        amountIn,
        trailBps,
        minAmountOut: minOut,
        expiry
      });

      const nextIdBefore = await orderBook.nextOrderId();
      const tx = await user.sendTransaction({ to: orderTxData.to, data: orderTxData.data });
      await tx.wait();
      const orderId = nextIdBefore;
      logStep('S4: Create Trailing Stop (mNVDA, 5% trail)', tx.hash, { orderId: orderId.toString(), peak: '$120', stop: '$114' });

      // Raise price to $140
      console.log('Raising price to $140 to test trailing ratchet...');
      await setMockPrice(mnvdaTarget, 140);

      // Wait for keeper to ratchet trailing stop up
      console.log(`Waiting for keeper to update trailing stop on order ${orderId}...`);
      let ratcheted = false;
      const rStart = Date.now();
      while (Date.now() - rStart < 30000) {
        const o = await orderBook.getOrder(orderId);
        if (Number(o.peakPrice) / 1e8 >= 140) {
          ratcheted = true;
          console.log(`Trailing stop ratcheted: peak = $${Number(o.peakPrice) / 1e8}, stop = $${Number(o.triggerPrice) / 1e8}`);
          break;
        }
        await sleep(2000);
      }
      if (!ratcheted) console.log('Notice: Keeper may check ratchet on next tick');

      // Drop price to $130 (below $133 = 140 * 0.95)
      console.log('Dropping price to $130 to trigger ratcheted trailing stop...');
      await setMockPrice(mnvdaTarget, 130);

      await waitForOrderStatus(orderId, 2);

      results.scenarios.scenario4 = {
        name: 'Trailing stop raised then filled (mNVDA - 18 decimals)',
        status: 'PASS',
        orderId: orderId.toString(),
        peakPrice: '140',
        fillPrice: '130'
      };
      console.log('S4: PASS - Trailing stop executed successfully!');
    } catch (e) {
      console.error('S4 FAIL:', e.message);
      results.scenarios.scenario4 = { status: 'FAIL', reason: e.message };
    }

    // =========================================================================
    // SCENARIO 5: Bracket (Take-profit fills and Stop-loss leg cancels) (mAAPL - 8 decimals)
    // =========================================================================
    console.log('\n===============================================================');
    console.log('SCENARIO 5: Bracket Order (mAAPL - 8 decimals)');
    console.log('===============================================================');
    try {
      await setMockPrice(maaplTarget, 165); // Current price $165
      const amountIn = ethers.parseUnits("0.05", 8);
      const tpPrice = parseTriggerPrice("180");
      const slPrice = parseTriggerPrice("150");
      const tpExp = expectedAmountOut("LIMIT_SELL", amountIn, tpPrice, 8, 6);
      const slExp = expectedAmountOut("STOP_LOSS", amountIn, slPrice, 8, 6);
      const tpMinOut = minAmountOut(tpExp, 100);
      const slMinOut = minAmountOut(slExp, 100);
      const expiry = Math.floor(Date.now() / 1000) + 86400;

      const orderTxData = buildCreateBracketCall({
        orderBook: dep.orderBook,
        stockToken: maaplTarget.stockToken,
        amountIn,
        takeProfitPrice: tpPrice,
        stopLossPrice: slPrice,
        minOutTakeProfit: tpMinOut,
        minOutStopLoss: slMinOut,
        expiry
      });

      const nextIdBefore = await orderBook.nextOrderId();
      const tx = await user.sendTransaction({ to: orderTxData.to, data: orderTxData.data });
      await tx.wait();
      const tpId = nextIdBefore;
      const slId = nextIdBefore + 1n;
      logStep('S5: Create Bracket Order (mAAPL)', tx.hash, { tpId: tpId.toString(), slId: slId.toString() });

      // Move price to $185 to fill take-profit leg
      await setMockPrice(maaplTarget, 185);

      console.log(`Waiting for keeper to execute take-profit leg (${tpId})...`);
      await waitForOrderStatus(tpId, 2); // EXECUTED

      console.log(`Verifying stop-loss leg (${slId}) is cancelled...`);
      const slOrder = await orderBook.getOrder(slId);
      // status 3 = CANCELLED
      if (Number(slOrder.status) !== 3) {
        throw new Error(`Expected stop-loss leg to be CANCELLED (3), got ${slOrder.status}`);
      }

      results.scenarios.scenario5 = {
        name: 'Bracket order (take-profit fills, stop-loss cancels)',
        status: 'PASS',
        takeProfitId: tpId.toString(),
        stopLossId: slId.toString(),
        takeProfitStatus: 'EXECUTED (2)',
        stopLossStatus: 'CANCELLED (3)'
      };
      console.log('S5: PASS - Bracket legs verified!');
    } catch (e) {
      console.error('S5 FAIL:', e.message);
      results.scenarios.scenario5 = { status: 'FAIL', reason: e.message };
    }

    // =========================================================================
    // SCENARIO 6: Edit then fill (mNVDA - 18 decimals)
    // =========================================================================
    console.log('\n===============================================================');
    console.log('SCENARIO 6: Edit then Fill (mNVDA - 18 decimals)');
    console.log('===============================================================');
    try {
      await setMockPrice(mnvdaTarget, 130); // Current price $130
      const amountIn = ethers.parseUnits("10", 6); // 10 mUSDC
      const initialTrigger = parseTriggerPrice("110");
      const initExp = expectedAmountOut("LIMIT_BUY", amountIn, initialTrigger, 18, 6);
      const initMin = minAmountOut(initExp, 100);
      const expiry = Math.floor(Date.now() / 1000) + 86400;

      const orderTxData = buildCreateOrderCall({
        orderBook: dep.orderBook,
        stockToken: mnvdaTarget.stockToken,
        orderType: 0,
        amountIn,
        triggerPrice: initialTrigger,
        minAmountOut: initMin,
        expiry
      });

      const nextIdBefore = await orderBook.nextOrderId();
      const tx = await user.sendTransaction({ to: orderTxData.to, data: orderTxData.data });
      await tx.wait();
      const orderId = nextIdBefore;
      logStep('S6: Create Limit Buy with Trigger $110', tx.hash, { orderId: orderId.toString() });

      // Edit trigger to $125
      const newTrigger = parseTriggerPrice("125");
      const newExp = expectedAmountOut("LIMIT_BUY", amountIn, newTrigger, 18, 6);
      const newMin = minAmountOut(newExp, 100);

      const updateTxData = buildUpdateOrderCall({
        orderBook: dep.orderBook,
        orderId,
        newTrigger,
        newMinAmountOut: newMin
      });

      const txUpdate = await user.sendTransaction({ to: updateTxData.to, data: updateTxData.data });
      await txUpdate.wait();
      logStep('S6: Update Order Trigger to $125', txUpdate.hash, { orderId: orderId.toString() });

      // Move price to $120 (below $125) to trigger
      await setMockPrice(mnvdaTarget, 120);

      console.log(`Waiting for keeper to execute edited order ${orderId}...`);
      await waitForOrderStatus(orderId, 2);

      results.scenarios.scenario6 = {
        name: 'Edit then fill (mNVDA - 18 decimals)',
        status: 'PASS',
        orderId: orderId.toString(),
        originalTrigger: '110',
        editedTrigger: '125',
        fillPrice: '120'
      };
      console.log('S6: PASS - Edit then fill verified!');
    } catch (e) {
      console.error('S6 FAIL:', e.message);
      results.scenarios.scenario6 = { status: 'FAIL', reason: e.message };
    }

    // =========================================================================
    // SCENARIO 7: Cancel with refund (mAAPL - 8 decimals)
    // =========================================================================
    console.log('\n===============================================================');
    console.log('SCENARIO 7: Cancel with Refund (mAAPL - 8 decimals)');
    console.log('===============================================================');
    try {
      await setMockPrice(maaplTarget, 185);
      const amountIn = ethers.parseUnits("15", 6); // 15 mUSDC
      const triggerPrice = parseTriggerPrice("150");
      const expOut = expectedAmountOut("LIMIT_BUY", amountIn, triggerPrice, 8, 6);
      const minOut = minAmountOut(expOut, 100);
      const expiry = Math.floor(Date.now() / 1000) + 86400;

      const orderTxData = buildCreateOrderCall({
        orderBook: dep.orderBook,
        stockToken: maaplTarget.stockToken,
        orderType: 0,
        amountIn,
        triggerPrice,
        minAmountOut: minOut,
        expiry
      });

      const nextIdBefore = await orderBook.nextOrderId();
      const tx = await user.sendTransaction({ to: orderTxData.to, data: orderTxData.data });
      await tx.wait();
      const orderId = nextIdBefore;
      logStep('S7: Create Order to Cancel (mAAPL)', tx.hash, { orderId: orderId.toString() });

      const balBefore = await quoteContract.balanceOf(user.address);

      const cancelTxData = buildCancelOrderCall(dep.orderBook, orderId);
      const txCancel = await user.sendTransaction({ to: cancelTxData.to, data: cancelTxData.data });
      await txCancel.wait();
      logStep('S7: Cancel Order', txCancel.hash, { orderId: orderId.toString() });

      const balAfter = await quoteContract.balanceOf(user.address);
      const refunded = balAfter - balBefore;

      if (refunded !== amountIn) {
        throw new Error(`Refund mismatch: expected ${amountIn}, got ${refunded}`);
      }

      const o = await orderBook.getOrder(orderId);
      if (Number(o.status) !== 3) {
        throw new Error(`Expected order status CANCELLED (3), got ${o.status}`);
      }

      results.scenarios.scenario7 = {
        name: 'Cancel with refund (mAAPL - 8 decimals)',
        status: 'PASS',
        orderId: orderId.toString(),
        refundedAmount: refunded.toString()
      };
      console.log(`S7: PASS - Cancelled and refunded ${ethers.formatUnits(refunded, 6)} mUSDC!`);
    } catch (e) {
      console.error('S7 FAIL:', e.message);
      results.scenarios.scenario7 = { status: 'FAIL', reason: e.message };
    }

    // =========================================================================
    // SCENARIO 8: DCA first buy then cancel with refund (mNVDA - 18 decimals)
    // =========================================================================
    console.log('\n===============================================================');
    console.log('SCENARIO 8: DCA First Buy then Cancel with Refund (mNVDA - 18 decimals)');
    console.log('===============================================================');
    try {
      await setMockPrice(mnvdaTarget, 120);
      const amountPerBuy = ethers.parseUnits("5", 6); // 5 mUSDC
      const buys = 3; // total deposit = 15 mUSDC
      const interval = 3600; // 1 hour
      const maxPrice = parseTriggerPrice("150"); // price ceiling $150

      const dcaTxData = buildCreateDcaCall({
        orderBook: dep.orderBook,
        stockToken: mnvdaTarget.stockToken,
        amountPerBuy,
        buys,
        interval,
        maxPrice
      });

      const nextPlanBefore = await orderBook.nextPlanId();
      const tx = await user.sendTransaction({ to: dcaTxData.to, data: dcaTxData.data });
      await tx.wait();
      const planId = nextPlanBefore;
      logStep('S8: Create DCA Plan (3 buys x 5 mUSDC)', tx.hash, { planId: planId.toString() });

      console.log(`Waiting for keeper to execute first buy of plan ${planId}...`);
      const planAfterBuy = await waitForDcaExecution(planId, buys);
      console.log(`Plan remaining buys: ${planAfterBuy.remaining}`);

      // Now cancel remaining buys
      const balBefore = await quoteContract.balanceOf(user.address);
      const cancelTxData = buildCancelDcaCall(dep.orderBook, planId);
      const txCancel = await user.sendTransaction({ to: cancelTxData.to, data: cancelTxData.data });
      await txCancel.wait();
      logStep('S8: Cancel DCA Plan', txCancel.hash, { planId: planId.toString() });

      const balAfter = await quoteContract.balanceOf(user.address);
      const refunded = balAfter - balBefore;
      const expectedRefund = amountPerBuy * BigInt(buys - 1); // 2 buys = 10 mUSDC

      if (refunded !== expectedRefund) {
        throw new Error(`DCA refund mismatch: expected ${expectedRefund}, got ${refunded}`);
      }

      results.scenarios.scenario8 = {
        name: 'DCA first buy then cancel with refund (mNVDA - 18 decimals)',
        status: 'PASS',
        planId: planId.toString(),
        firstBuyExecuted: true,
        remainingRefunded: refunded.toString()
      };
      console.log(`S8: PASS - First buy executed and remaining ${ethers.formatUnits(refunded, 6)} mUSDC refunded!`);
    } catch (e) {
      console.error('S8 FAIL:', e.message);
      results.scenarios.scenario8 = { status: 'FAIL', reason: e.message };
    }

  } finally {
    // Stop keeper child process
    console.log('\n--- Stopping keeper process ---');
    try {
      keeperProc.kill('SIGTERM');
      setTimeout(() => {
        try { keeperProc.kill('SIGKILL'); } catch {}
      }, 2000);
    } catch {}
  }

  // Write results JSON log
  const logFilePath = path.join(LOGS_DIR, 'demo-rehearsal.json');
  fs.writeFileSync(logFilePath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nRehearsal log written to: ${logFilePath}`);

  const logHash = crypto.createHash('sha256').update(fs.readFileSync(logFilePath)).digest('hex');
  console.log(`SHA-256: ${logHash}`);

  // Summary
  console.log('\n===============================================================');
  console.log('DEMO REHEARSAL SUMMARY');
  console.log('===============================================================');
  for (const [k, v] of Object.entries(results.scenarios)) {
    console.log(`${k} (${v.name}): ${v.status}${v.reason ? ' - ' + v.reason : ''}`);
  }
}

main().catch(err => {
  console.error('Rehearsal failed with unhandled error:', err);
  process.exit(1);
});
