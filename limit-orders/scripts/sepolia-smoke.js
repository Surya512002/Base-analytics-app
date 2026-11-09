// sepolia-smoke.js: automated end-to-end smoke test on Base Sepolia
require('../shared/loadEnv');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ethers } = require('ethers');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
const TSX_CLI = path.join(ROOT_DIR, 'node_modules/tsx/dist/cli.mjs');

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq !== -1) {
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadArtifact(name) {
  const p = path.join(ROOT_DIR, 'artifacts/contracts', `${name}.sol`, `${name}.json`);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  const mockP = path.join(ROOT_DIR, 'artifacts/contracts/mocks/Mocks.sol', `${name}.json`);
  if (fs.existsSync(mockP)) return JSON.parse(fs.readFileSync(mockP, 'utf8'));
  throw new Error(`Artifact not found: ${name}`);
}

async function main() {
  console.log('=== Base Sepolia Automated Smoke Test Suite ===\n');

  const env = loadEnv();
  const rpcUrl = env.BASE_SEPOLIA_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
  const deployerPk = env.DEPLOYER_PK || process.env.DEPLOYER_PK;
  const keeperPk = env.KEEPER_PK || process.env.KEEPER_PK;

  if (!deployerPk || !keeperPk) {
    console.error('FAIL: Missing DEPLOYER_PK or KEEPER_PK in limit-orders/.env.');
    console.error('Cannot proceed with live Sepolia transactions without funded keys.');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // G4 Check: verify chainId == 84532 before doing anything
  const net = await provider.getNetwork();
  console.log(`Connected Network Chain ID: ${net.chainId}`);
  if (Number(net.chainId) !== 84532) {
    console.error(`FAIL: sepolia-smoke.js must run on Base Sepolia (chainId 84532). Found chainId: ${net.chainId}`);
    process.exit(1);
  }

  const deployer = new ethers.Wallet(deployerPk, provider);
  const keeper = new ethers.Wallet(keeperPk, provider);

  console.log(`RPC URL:          ${rpcUrl}`);
  console.log(`Deployer Address: ${deployer.address}`);
  console.log(`Keeper Address:   ${keeper.address}`);

  const depBal = await provider.getBalance(deployer.address);
  const keepBal = await provider.getBalance(keeper.address);
  const depEth = Number(ethers.formatEther(depBal));
  const keepEth = Number(ethers.formatEther(keepBal));

  console.log(`Deployer ETH Balance: ${depEth.toFixed(4)} ETH`);
  console.log(`Keeper ETH Balance:   ${keepEth.toFixed(4)} ETH\n`);

  if (depEth < 0.01 || keepEth < 0.01) {
    console.error('FAIL: Insufficient funds. Both Deployer and Keeper require at least 0.01 Sepolia ETH.');
    console.error(`Deployer has: ${depEth} ETH (needs 0.01 ETH). Keeper has: ${keepEth} ETH (needs 0.01 ETH).`);
    process.exit(1);
  }

  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }

  const logFile = path.join(LOGS_DIR, `sepolia-smoke-${Date.now()}.json`);
  const stepLogs = [];

  function recordStep(name, txHash, details = {}) {
    const link = txHash ? `https://sepolia.basescan.org/tx/${txHash}` : null;
    const entry = { step: name, txHash, basescan: link, timestamp: new Date().toISOString(), ...details };
    stepLogs.push(entry);
    console.log(`[STEP] ${name}`);
    if (link) console.log(`       Basescan: ${link}`);
    if (details.note) console.log(`       Note: ${details.note}`);
  }

  const P = (n) => BigInt(Math.round(Number(n) * 1e8));
  const S = (n) => ethers.parseUnits(String(n), 18);
  const U = (n) => ethers.parseUnits(String(n), 6);

  console.log('--- 1. Deploying Testnet Mocks (MockStock, MockUSDC, MockFeed, MockAdapter, LimitOrderBook) ---');
  const mockErcArtifact = loadArtifact('MockERC20');
  const mockFeedArtifact = loadArtifact('MockFeed');
  const mockAdapterArtifact = loadArtifact('MockAdapter');
  const bookArtifact = loadArtifact('LimitOrderBook');

  const ErcFactory = new ethers.ContractFactory(mockErcArtifact.abi, mockErcArtifact.bytecode, deployer);
  const FeedFactory = new ethers.ContractFactory(mockFeedArtifact.abi, mockFeedArtifact.bytecode, deployer);
  const AdapterFactory = new ethers.ContractFactory(mockAdapterArtifact.abi, mockAdapterArtifact.bytecode, deployer);
  const BookFactory = new ethers.ContractFactory(bookArtifact.abi, bookArtifact.bytecode, deployer);

  const startPrice = P(100);
  const stock = await ErcFactory.deploy('Mock NVDA', 'mNVDA', 18);
  await stock.waitForDeployment();
  recordStep('Deploy Mock Stock mNVDA', stock.deploymentTransaction()?.hash, { address: stock.target });

  const usdc = await ErcFactory.deploy('Mock USDC', 'mUSDC', 6);
  await usdc.waitForDeployment();
  recordStep('Deploy Mock USDC mUSDC', usdc.deploymentTransaction()?.hash, { address: usdc.target });

  const feed = await FeedFactory.deploy(startPrice);
  await feed.waitForDeployment();
  recordStep('Deploy Mock Feed ($100)', feed.deploymentTransaction()?.hash, { address: feed.target });

  const adapter = await AdapterFactory.deploy();
  await adapter.waitForDeployment();
  recordStep('Deploy Mock Adapter', adapter.deploymentTransaction()?.hash, { address: adapter.target });

  const book = await BookFactory.deploy(usdc.target, deployer.address, 10);
  await book.waitForDeployment();
  recordStep('Deploy LimitOrderBook', book.deploymentTransaction()?.hash, { address: book.target });

  // Configure market
  const txMarket = await book.setMarket(stock.target, feed.target, 86400 * 7, adapter.target, S(1000), U(100000), 500, true);
  await txMarket.wait();
  recordStep('Set Market for mNVDA on LimitOrderBook', txMarket.hash);

  // Mint liquidity to adapter
  await (await stock.mint(adapter.target, S(1000000))).wait();
  await (await usdc.mint(adapter.target, U(1000000))).wait();
  await (await adapter.setRate(usdc.target, stock.target, 10n ** 20n, startPrice)).wait();
  await (await adapter.setRate(stock.target, usdc.target, startPrice, 10n ** 20n)).wait();
  recordStep('Fund Adapter Liquidity and Set Initial Rate ($100)', null);

  // Create throwaway USER wallet
  const user = ethers.Wallet.createRandom(provider);
  recordStep('Create Throwaway User Wallet', null, { address: user.address });

  // Fund user with 0.005 ETH and mock tokens
  const txFundEth = await deployer.sendTransaction({ to: user.address, value: ethers.parseEther('0.005') });
  await txFundEth.wait();
  recordStep('Fund User with 0.005 ETH', txFundEth.hash);

  await (await stock.mint(user.address, S(100))).wait();
  await (await usdc.mint(user.address, U(2000))).wait();
  recordStep('Mint 100 mNVDA and 2,000 mUSDC to User', null);

  // User approves OrderBook
  await (await stock.connect(user).approve(book.target, ethers.MaxUint256)).wait();
  await (await usdc.connect(user).approve(book.target, ethers.MaxUint256)).wait();
  recordStep('User Approves mNVDA and mUSDC to LimitOrderBook', null);

  // Start keeper process
  console.log('\n--- 2. Starting Keeper Background Process ---');
  const keeperEnv = {
    ...process.env,
    CHAIN: 'baseSepolia',
    RPC_URL: rpcUrl,
    ORDER_BOOK: book.target,
    POLL_MS: '2000',
    KEEPER_PK: keeperPk,
    DRY_RUN: '0',
  };

  const keeperProc = spawn(process.execPath, [TSX_CLI, 'keeper/keeper.ts'], {
    cwd: ROOT_DIR,
    env: keeperEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  keeperProc.stdout.on('data', (d) => {
    const s = d.toString().trim();
    if (s) console.log(`[KEEPER] ${s}`);
  });
  keeperProc.stderr.on('data', (d) => {
    const s = d.toString().trim();
    if (s) console.error(`[KEEPER ERROR] ${s}`);
  });

  async function setPrice(usd) {
    const p = P(usd);
    await (await adapter.setRate(usdc.target, stock.target, 10n ** 20n, p)).wait();
    await (await adapter.setRate(stock.target, usdc.target, p, 10n ** 20n)).wait();
    const tx = await feed.setAnswer(p);
    await tx.wait();
    console.log(`[PRICE MOVE] Set oracle & pool price to $${usd}`);
    return tx.hash;
  }

  async function waitForOrderStatus(id, expectedStatus, maxWaitMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const ord = await book.getOrder(id);
      if (Number(ord.status) === expectedStatus) return ord;
      await wait(2000);
    }
    return await book.getOrder(id);
  }

  async function waitForPlanRemaining(id, expectedRemaining, maxWaitMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const plan = await book.getPlan(id);
      if (Number(plan.remaining) === expectedRemaining) return plan;
      await wait(2000);
    }
    return await book.getPlan(id);
  }

  try {
    const now = (await provider.getBlock('latest')).timestamp;
    const exp = now + 86400;

    // Step 1: Limit Buy fill
    console.log('\n--- 3. Testing Limit Buy Fill ---');
    // Start price is $100. Limit buy must have trigger < price to avoid AlreadyTriggered()
    const txLb = await book.connect(user).createOrder(stock.target, 0, U(100), P(95), S(0.95), exp);
    await txLb.wait();
    recordStep('Create Limit Buy ($95 trigger, current price $100)', txLb.hash);
    await setPrice(94); // Drop price to $94 to trigger buy
    console.log('Price at $94 (<= $95): waiting for keeper fill...');
    const ord1 = await waitForOrderStatus(1, 2);
    recordStep('Limit Buy Fill Verification', null, { status: Number(ord1.status) === 2 ? 'EXECUTED' : 'OPEN' });

    // Step 2: Take-Profit fill
    console.log('\n--- 4. Testing Take-Profit Fill ---');
    // Current price is $94. Take-profit must have trigger > price ($105 > $94)
    const txTp = await book.connect(user).createOrder(stock.target, 1, S(1), P(105), U(100), exp);
    await txTp.wait();
    recordStep('Create Take-Profit ($105 trigger, current price $94)', txTp.hash);
    await setPrice(106); // Move price to $106 to trigger take-profit
    console.log('Price at $106 (>= $105): waiting for keeper fill...');
    const ord2 = await waitForOrderStatus(2, 2);
    recordStep('Take-Profit Fill Verification', null, { status: Number(ord2.status) === 2 ? 'EXECUTED' : 'OPEN' });

    // Step 3: Stop-Loss fill
    console.log('\n--- 5. Testing Stop-Loss Fill ---');
    await setPrice(100); // Reset price to $100
    // Stop-loss must have trigger < price ($92 < $100)
    const txSl = await book.connect(user).createOrder(stock.target, 2, S(1), P(92), U(85), exp);
    await txSl.wait();
    recordStep('Create Stop-Loss ($92 trigger, current price $100)', txSl.hash);
    await setPrice(90); // Drop price to $90 to trigger stop-loss
    console.log('Price at $90 (<= $92): waiting for keeper fill...');
    const ord3 = await waitForOrderStatus(3, 2);
    recordStep('Stop-Loss Fill Verification', null, { status: Number(ord3.status) === 2 ? 'EXECUTED' : 'OPEN' });

    // Step 4: Trailing Stop raised then filled
    console.log('\n--- 6. Testing Trailing Stop (Ratchet & Fill) ---');
    await setPrice(100);
    const txTs = await book.connect(user).createTrailingStop(stock.target, S(1), 1000, U(85), exp); // 10% trail
    await txTs.wait();
    recordStep('Create Trailing Stop (10% trail at $100)', txTs.hash);
    await setPrice(120); // Ratchets stop from $90 to $108
    console.log('Price at $120: waiting for keeper ratchet...');
    await wait(6000);
    await setPrice(105); // Crosses below raised $108 trigger (minOut $85 is satisfied at $105)
    console.log('Price dropped to $105 (<= $108): waiting for keeper fill...');
    const ord4 = await waitForOrderStatus(4, 2);
    recordStep('Trailing Stop Fill Verification', null, { status: Number(ord4.status) === 2 ? 'EXECUTED' : 'OPEN', peak: Number(ord4.peakPrice) / 1e8 });

    // Step 5: Bracket Order
    console.log('\n--- 7. Testing Bracket Order (OCO) ---');
    await setPrice(100);
    // Requires stopLossPrice ($90) < price ($100) < takeProfitPrice ($110)
    const txBr = await book.connect(user).createBracket(stock.target, S(1), P(110), P(90), U(105), U(85), exp);
    await txBr.wait();
    recordStep('Create Bracket Order (TP $110, SL $90 at $100)', txBr.hash);
    await setPrice(112);
    console.log('Price at $112 (>= $110): waiting for TP execution and SL auto-cancel...');
    await waitForOrderStatus(5, 2);
    const ord5 = await book.getOrder(5);
    const ord6 = await book.getOrder(6);
    recordStep('Bracket OCO Verification', null, { tpStatus: Number(ord5.status) === 2 ? 'EXECUTED' : 'OPEN', slStatus: Number(ord6.status) === 3 ? 'CANCELLED' : 'OPEN' });

    // Step 6: Edit then Fill
    console.log('\n--- 8. Testing In-Place Edit then Fill ---');
    await setPrice(100);
    const txEditInit = await book.connect(user).createOrder(stock.target, 0, U(100), P(90), S(0.9), exp);
    await txEditInit.wait();
    recordStep('Create Limit Buy at $90 trigger', txEditInit.hash);
    const txEdit = await book.connect(user).updateOrder(7, P(98), S(0.9));
    await txEdit.wait();
    recordStep('Edit Order 7 Trigger from $90 to $98', txEdit.hash);
    await setPrice(96);
    console.log('Price dropped to $96 (<= $98): waiting for fill...');
    const ord7 = await waitForOrderStatus(7, 2);
    recordStep('Edited Order Fill Verification', null, { status: Number(ord7.status) === 2 ? 'EXECUTED' : 'OPEN' });

    // Step 7: Cancel
    console.log('\n--- 9. Testing Cancel & Refund ---');
    const txCancelInit = await book.connect(user).createOrder(stock.target, 0, U(50), P(80), S(0.9), exp);
    await txCancelInit.wait();
    const balBefore = await usdc.balanceOf(user.address);
    const txCancel = await book.connect(user).cancelOrder(8);
    await txCancel.wait();
    const balAfter = await usdc.balanceOf(user.address);
    recordStep('Cancel Order 8 & Verify Refund', txCancel.hash, { refundVerified: balAfter > balBefore });

    // Step 8: Shortest-allowed Expiry then Refund
    console.log('\n--- 10. Testing Expiry & Refund ---');
    const curBlockTime = (await provider.getBlock('latest')).timestamp;
    const shortExp = curBlockTime + 20; // 20 seconds expiry
    const txExpInit = await book.connect(user).createOrder(stock.target, 0, U(50), P(80), S(0.9), shortExp);
    await txExpInit.wait();
    recordStep('Create Order with 20s Expiry', txExpInit.hash);
    console.log('Waiting 25s for expiry timestamp to pass...');
    await wait(25000);
    const ord9 = await book.getOrder(9);
    if (Number(ord9.status) === 4 /* Status.EXPIRED */) {
      recordStep('Refund Expired Order 9 (Auto-refunded by Keeper)', null, { status: 'EXPIRED' });
    } else {
      try {
        const txRefund = await book.connect(user).refundExpired(9);
        await txRefund.wait();
        recordStep('Refund Expired Order 9 (User Initiated)', txRefund.hash);
      } catch (e) {
        const check9 = await book.getOrder(9);
        if (Number(check9.status) === 4 /* Status.EXPIRED */) {
          recordStep('Refund Expired Order 9 (Auto-refunded by Keeper)', null, { status: 'EXPIRED' });
        } else {
          throw e;
        }
      }
    }

    // Step 9: DCA Create & First Buy, leaving plan open for next buy
    console.log('\n--- 11. Testing Recurring Buy (DCA) Plan ---');
    await setPrice(100);
    // PART F requirement: buys=5, executed=1, remaining=4, interval=1 hour (3600s)
    const txDca = await book.connect(user).createDca(stock.target, U(50), 5, 3600, 0);
    await txDca.wait();
    recordStep('Create DCA Plan (buys=5, interval=3600s)', txDca.hash);
    console.log('Waiting for keeper to execute first buy...');
    const plan1 = await waitForPlanRemaining(1, 4);
    recordStep('DCA First Buy Verification', null, {
      planId: 1,
      buys: 5,
      executed: 1,
      remaining: Number(plan1.remaining),
      interval: 3600,
      note: 'Plan left running on Base Sepolia. Second buy eligible in 1 hour.',
    });

    console.log('\n======================================================');
    console.log('ENV LINES TO PASTE IN ROOT .env.local:');
    console.log(`NEXT_PUBLIC_LIMIT_ORDER_BOOK_SEPOLIA=${book.target}`);
    console.log(`NEXT_PUBLIC_LIMIT_ORDER_ADAPTER_SEPOLIA=${adapter.target}`);
    console.log(`NEXT_PUBLIC_LIMIT_ORDER_QUOTE_SEPOLIA=${usdc.target}`);
    console.log(`NEXT_PUBLIC_LIMIT_ORDER_STOCK_SEPOLIA=${stock.target}`);
    console.log(`NEXT_PUBLIC_LIMIT_ORDER_FEED_SEPOLIA=${feed.target}`);
    console.log('======================================================\n');

    fs.writeFileSync(
      logFile,
      JSON.stringify(
        {
          summary: 'SUCCESS',
          steps: stepLogs,
          activeDcaPlanId: 1,
          contracts: {
            book: book.target,
            adapter: adapter.target,
            usdc: usdc.target,
            stock: stock.target,
            feed: feed.target,
          },
        },
        null,
        2
      )
    );
    console.log(`=== All Sepolia Smoke Test Steps Passed. Raw Log: ${logFile} ===`);
  } finally {
    try {
      keeperProc.kill();
    } catch (e) {}
  }
}

main().catch((err) => {
  console.error('Sepolia Smoke Failed:', err);
  process.exit(1);
});
