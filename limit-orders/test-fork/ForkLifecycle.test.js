const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const path = require("path");
const fs = require("fs");
const { getWrapperFeedFactory } = require("./wrapperFeed");

describe("Base Mainnet Fork, MOCKED stock tokens", function () {
  this.timeout(180000); // 3 minutes for network fork operations

  const FORK_RPC = process.env.BASE_FORK_RPC || "https://mainnet.base.org";
  const USDC_WHALE = "0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A";
  const ROUTER_ADDRESS = "0x2626664c2603336E57B271c5C0b26F421741e481";
  const UNISWAP_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";

  let deployer, alice, bob, keeper;
  let book, adapter;
  let usdc;
  let wrapperFactory;
  let deployConfig;

  before(async function () {
    // 1. Reset / initialize fork on in-process Hardhat network
    await network.provider.request({
      method: "hardhat_reset",
      params: [{ forking: { jsonRpcUrl: FORK_RPC } }],
    });

    [deployer, alice, bob, keeper] = await ethers.getSigners();

    // 2. Fund accounts with ETH and USDC from whale
    await network.provider.request({ method: "hardhat_impersonateAccount", params: [USDC_WHALE] });
    await network.provider.send("hardhat_setBalance", [USDC_WHALE, "0x56BC75E2D63100000"]); // 100 ETH
    const whaleSigner = await ethers.getSigner(USDC_WHALE);

    const cfgPath = path.join(__dirname, "../config/deployConfig.json");
    deployConfig = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));

    usdc = await ethers.getContractAt("IERC20", deployConfig.quoteToken, whaleSigner);
    // Transfer 10,000 USDC each to Alice, Bob, and deployer
    await (await usdc.transfer(alice.address, ethers.parseUnits("10000", 6))).wait();
    await (await usdc.transfer(bob.address, ethers.parseUnits("10000", 6))).wait();
    await (await usdc.transfer(deployer.address, ethers.parseUnits("10000", 6))).wait();

    // 3. Deploy LimitOrderBook and UniswapV3Adapter
    const BookFactory = await ethers.getContractFactory("LimitOrderBook");
    book = await BookFactory.deploy(deployConfig.quoteToken, deployer.address, deployConfig.keeperFeeBps);
    await book.waitForDeployment();

    const AdapterFactory = await ethers.getContractFactory("UniswapV3Adapter");
    adapter = await AdapterFactory.deploy(book.target, ROUTER_ADDRESS, deployer.address);
    await adapter.waitForDeployment();

    wrapperFactory = await getWrapperFeedFactory();

    // 4. Install MockERC20 bytecode onto the 4 stock addresses so Hardhat EVM can execute their transfers
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const sampleMock = await MockERC20Factory.deploy("Sample", "SMP", 8);
    await sampleMock.waitForDeployment();
    const mockBytecode = await ethers.provider.getCode(await sampleMock.getAddress());

    const factory = await ethers.getContractAt(
      ["function getPool(address, address, uint24) view returns (address)"],
      UNISWAP_FACTORY
    );

    for (const m of deployConfig.markets) {
      const stockAddr = ethers.getAddress(m.stockToken);
      await network.provider.send("hardhat_setCode", [stockAddr, mockBytecode]);

      // Mint initial stock to Alice and Bob for testing sell / deposit orders
      const stockToken = await ethers.getContractAt("MockERC20", stockAddr, deployer);
      await stockToken.mint(alice.address, ethers.parseUnits("50", 8));
      await stockToken.mint(bob.address, ethers.parseUnits("50", 8));

      // Query primary Uniswap pool and mint stock liquidity to pool
      const pool = await factory.getPool(stockAddr, deployConfig.quoteToken, m.poolFee);
      if (pool && pool !== ethers.ZeroAddress) {
        await stockToken.mint(pool, ethers.parseUnits("10000", 8));
      }

      // Deploy MockWrapperFeed for this market wrapping real feed
      const wrapperFeed = await wrapperFactory.connect(deployer).deploy(ethers.getAddress(m.feed));
      await wrapperFeed.waitForDeployment();

      // Configure market in LimitOrderBook
      await (
        await book.setMarket(
          stockAddr,
          wrapperFeed.target,
          m.maxStaleness,
          adapter.target,
          BigInt(m.maxStockIn),
          BigInt(m.maxQuoteIn),
          m.maxDeviationBps,
          true
        )
      ).wait();

      // Configure pool fee on UniswapV3Adapter
      await (await adapter.setPoolFee(stockAddr, deployConfig.quoteToken, m.poolFee)).wait();

      m.wrapperFeed = wrapperFeed;
      m.stockContract = stockToken;
    }
  });

  const MARKETS_TO_TEST = ["NVDAc", "AAPLc", "MSFTc", "GOOGLc"];

  for (const symbol of MARKETS_TO_TEST) {
    describe(`Market: ${symbol} Full Flow`, function () {
      let m, stock, wrapperFeed;
      const getLatestPrice = async () => {
        const round = await wrapperFeed.latestRoundData();
        return round[1];
      };

      before(function () {
        m = deployConfig.markets.find((x) => x.symbol === symbol);
        expect(m, `Market ${symbol} must be in deployConfig.json`).to.not.be.undefined;
        stock = m.stockContract;
        wrapperFeed = m.wrapperFeed;
      });

      afterEach(async function () {
        // Reset feed scaling to 1:1 after each test
        await wrapperFeed.setScale(1, 1);
      });

      it(`(a) verifies deposit and withdraw of stock token and USDC to/from order book`, async function () {
        const stockAmount = ethers.parseUnits("0.2", 8); // under beta cap
        const usdcAmount = ethers.parseUnits("30", 6); // $30 under beta cap ($100)

        // 1. Stock deposit and withdraw via create & cancel sell order
        await (await stock.connect(alice).approve(book.target, stockAmount)).wait();
        const curPrice = await getLatestPrice();
        const highTrigger = (curPrice * 120n) / 100n; // 20% above, won't trigger immediately
        const expiry = (await ethers.provider.getBlock("latest")).timestamp + 86400;

        const balStockBefore = await stock.balanceOf(alice.address);
        const tx1 = await book.connect(alice).createOrder(stock.target, 1 /* LIMIT_SELL */, stockAmount, highTrigger, 1, expiry);
        const rc1 = await tx1.wait();
        const id1 = rc1.logs.find((x) => x.fragment && x.fragment.name === "OrderCreated").args[0];

        // Stock was escrowed
        expect(await stock.balanceOf(alice.address)).to.equal(balStockBefore - stockAmount);

        // Cancel order -> stock is refunded to Alice
        await (await book.connect(alice).cancelOrder(id1)).wait();
        expect(await stock.balanceOf(alice.address)).to.equal(balStockBefore);

        // 2. USDC deposit and withdraw via create & cancel buy order
        await (await usdc.connect(alice).approve(book.target, usdcAmount)).wait();
        const lowTrigger = (curPrice * 80n) / 100n; // 20% below, won't trigger immediately

        const balUsdcBefore = await usdc.balanceOf(alice.address);
        const tx2 = await book.connect(alice).createOrder(stock.target, 0 /* LIMIT_BUY */, usdcAmount, lowTrigger, 1, expiry);
        const rc2 = await tx2.wait();
        const id2 = rc2.logs.find((x) => x.fragment && x.fragment.name === "OrderCreated").args[0];

        // USDC was escrowed
        expect(await usdc.balanceOf(alice.address)).to.equal(balUsdcBefore - usdcAmount);

        // Cancel order -> USDC is refunded to Alice
        await (await book.connect(alice).cancelOrder(id2)).wait();
        expect(await usdc.balanceOf(alice.address)).to.equal(balUsdcBefore);
      });

      it(`(b) creates, triggers, and executes a Limit Buy (Type 0)`, async function () {
        const quoteIn = ethers.parseUnits("50", 6); // $50
        const curPrice = await getLatestPrice();
        // Target: 99.5% of market price. Expiry: 1 day.
        const targetPrice = (curPrice * 995n) / 1000n;
        const expiry = (await ethers.provider.getBlock("latest")).timestamp + 86400;

        await (await usdc.connect(alice).approve(book.target, quoteIn)).wait();
        const tx = await book.connect(alice).createOrder(stock.target, 0, quoteIn, targetPrice, 1, expiry);
        const rc = await tx.wait();
        const id = rc.logs.find((x) => x.fragment && x.fragment.name === "OrderCreated").args[0];

        expect(await book.canExecute(id)).to.be.false;

        // Drop price by 1% to 99.0% on the wrapper feed (<= 99.5% target).
        // Since 1% drop is well within the 300 bps (3%) oracle guard, fill passes!
        await wrapperFeed.setScale(990, 1000);
        expect(await book.canExecute(id)).to.be.true;

        const aliceStockBefore = await stock.balanceOf(alice.address);
        await (await book.connect(keeper).executeOrder(id)).wait();

        const order = await book.getOrder(id);
        expect(order.status).to.equal(2); // Status.FILLED == 2
        expect(await stock.balanceOf(alice.address)).to.be.greaterThan(aliceStockBefore);
      });

      it(`(b) creates, triggers, and executes a Take-Profit (Type 1)`, async function () {
        const stockIn = ethers.parseUnits("0.1", 8);
        const curPrice = await getLatestPrice();
        // Target: 100.5% of market price.
        const targetPrice = (curPrice * 1005n) / 1000n;
        const expiry = (await ethers.provider.getBlock("latest")).timestamp + 86400;

        await (await stock.connect(alice).approve(book.target, stockIn)).wait();
        const tx = await book.connect(alice).createOrder(stock.target, 1, stockIn, targetPrice, 1, expiry);
        const rc = await tx.wait();
        const id = rc.logs.find((x) => x.fragment && x.fragment.name === "OrderCreated").args[0];

        expect(await book.canExecute(id)).to.be.false;

        // Raise price by 1% to 101.0% on the wrapper feed (>= 100.5% target).
        // Real pool fills at ~100%, which is well within 300 bps of 101%!
        await wrapperFeed.setScale(1010, 1000);
        expect(await book.canExecute(id)).to.be.true;

        const aliceUsdcBefore = await usdc.balanceOf(alice.address);
        await (await book.connect(keeper).executeOrder(id)).wait();

        const order = await book.getOrder(id);
        expect(order.status).to.equal(2); // Status.FILLED == 2
        expect(await usdc.balanceOf(alice.address)).to.be.greaterThan(aliceUsdcBefore);
      });

      it(`(b) creates, triggers, and executes a Stop-Loss (Type 2)`, async function () {
        const stockIn = ethers.parseUnits("0.1", 8);
        const curPrice = await getLatestPrice();
        // Stop: 99.5% of market price.
        const stopPrice = (curPrice * 995n) / 1000n;
        const expiry = (await ethers.provider.getBlock("latest")).timestamp + 86400;

        await (await stock.connect(alice).approve(book.target, stockIn)).wait();
        const tx = await book.connect(alice).createOrder(stock.target, 2, stockIn, stopPrice, 1, expiry);
        const rc = await tx.wait();
        const id = rc.logs.find((x) => x.fragment && x.fragment.name === "OrderCreated").args[0];

        expect(await book.canExecute(id)).to.be.false;

        // Drop price by 1% to 99.0%
        await wrapperFeed.setScale(990, 1000);
        expect(await book.canExecute(id)).to.be.true;

        const aliceUsdcBefore = await usdc.balanceOf(alice.address);
        await (await book.connect(keeper).executeOrder(id)).wait();

        const order = await book.getOrder(id);
        expect(order.status).to.equal(2); // Status.FILLED == 2
        expect(await usdc.balanceOf(alice.address)).to.be.greaterThan(aliceUsdcBefore);
      });

      it(`(b) creates, ratchets up, and executes a Trailing Stop (Type 3)`, async function () {
        const stockIn = ethers.parseUnits("0.1", 8);
        const trailBps = 100; // 1% trail
        const expiry = (await ethers.provider.getBlock("latest")).timestamp + 86400;

        await (await stock.connect(alice).approve(book.target, stockIn)).wait();
        const tx = await book.connect(alice).createTrailingStop(stock.target, stockIn, trailBps, 1, expiry);
        const rc = await tx.wait();
        const id = rc.logs.find((x) => x.fragment && x.fragment.name === "OrderCreated").args[0];

        const initialOrder = await book.getOrder(id);
        const initialStop = initialOrder.triggerPrice;

        // Price rises 1% -> keeper ratchets trailing stop up
        await wrapperFeed.setScale(1010, 1000);
        expect(await book.canUpdateTrailing(id)).to.be.true;
        await (await book.connect(keeper).updateTrailing(id)).wait();

        const updatedOrder = await book.getOrder(id);
        expect(updatedOrder.triggerPrice).to.be.greaterThan(initialStop);

        // Price now drops below the new ratcheted stop
        await wrapperFeed.setScale(990, 1000);
        expect(await book.canExecute(id)).to.be.true;

        await (await book.connect(keeper).executeOrder(id)).wait();

        const filledOrder = await book.getOrder(id);
        expect(filledOrder.status).to.equal(2); // Status.FILLED == 2
      });

      it(`(b) creates a Bracket order and verifies take-profit fill closes stop-loss leg`, async function () {
        const stockIn = ethers.parseUnits("0.1", 8);
        const curPrice = await getLatestPrice();
        const tpPrice = (curPrice * 1005n) / 1000n; // +0.5%
        const slPrice = (curPrice * 990n) / 1000n; // -1.0%
        const expiry = (await ethers.provider.getBlock("latest")).timestamp + 86400;

        await (await stock.connect(alice).approve(book.target, stockIn)).wait();
        const tx = await book.connect(alice).createBracket(stock.target, stockIn, tpPrice, slPrice, 1, 1, expiry);
        const rc = await tx.wait();
        const orderLogs = rc.logs.filter((x) => x.fragment && x.fragment.name === "OrderCreated");
        const tpId = orderLogs[0].args[0];
        const slId = orderLogs[1].args[0];

        // Raise price by 1% to trigger take-profit
        await wrapperFeed.setScale(1010, 1000);
        expect(await book.canExecute(tpId)).to.be.true;
        expect(await book.canExecute(slId)).to.be.false;

        await (await book.connect(keeper).executeOrder(tpId)).wait();

        const tpOrder = await book.getOrder(tpId);
        const slOrder = await book.getOrder(slId);
        expect(tpOrder.status).to.equal(2); // Status.FILLED == 2
        expect(slOrder.status).to.equal(3); // Status.CANCELLED == 3
      });

      it(`(c) creates a DCA plan and executes two scheduled buys`, async function () {
        const buyAmount = ethers.parseUnits("25", 6); // $25 per buy
        const buys = 2;
        const interval = 3600; // 1 hour
        const curPrice = await getLatestPrice();
        const ceiling = (curPrice * 120n) / 100n; // +20% max price

        await (await usdc.connect(alice).approve(book.target, buyAmount * BigInt(buys))).wait();
        const tx = await book.connect(alice).createDca(stock.target, buyAmount, buys, interval, ceiling);
        const rc = await tx.wait();
        const dcaLog = rc.logs.find((x) => x.fragment && x.fragment.name === "DcaCreated");
        const planId = dcaLog.args[0];

        // Execute Buy 1 immediately
        expect(await book.canExecuteDca(planId)).to.be.true;
        await (await book.connect(keeper).executeDca(planId)).wait();

        let plan = await book.getPlan(planId);
        expect(plan.remaining).to.equal(1);
        expect(plan.status).to.equal(1); // Status.OPEN == 1
        expect(await book.canExecuteDca(planId)).to.be.false;

        // Fast-forward EVM time by 3600s
        await network.provider.send("evm_increaseTime", [3601]);
        await network.provider.send("evm_mine");

        // Execute Buy 2
        expect(await book.canExecuteDca(planId)).to.be.true;
        await (await book.connect(keeper).executeDca(planId)).wait();

        plan = await book.getPlan(planId);
        expect(plan.remaining).to.equal(0);
        expect(plan.status).to.equal(2); // Status.FILLED == 2 (completed)
      });

      it(`(d) verifies cancel active order, refund expired order, and cancel DCA plan`, async function () {
        const now = (await ethers.provider.getBlock("latest")).timestamp;
        const curPrice = await getLatestPrice();

        // 1. Cancel active order
        const stockIn = ethers.parseUnits("0.1", 8);
        await (await stock.connect(alice).approve(book.target, stockIn)).wait();
        const tx1 = await book.connect(alice).createOrder(stock.target, 1, stockIn, (curPrice * 120n) / 100n, 1, now + 86400);
        const id1 = (await tx1.wait()).logs.find((x) => x.fragment && x.fragment.name === "OrderCreated").args[0];

        const aliceStock1 = await stock.balanceOf(alice.address);
        await (await book.connect(alice).cancelOrder(id1)).wait();
        expect(await stock.balanceOf(alice.address)).to.equal(aliceStock1 + stockIn);

        // 2. Refund expired order after time passes (called by keeper)
        await (await stock.connect(alice).approve(book.target, stockIn)).wait();
        const shortExpiry = now + 100;
        const tx2 = await book.connect(alice).createOrder(stock.target, 1, stockIn, (curPrice * 120n) / 100n, 1, shortExpiry);
        const id2 = (await tx2.wait()).logs.find((x) => x.fragment && x.fragment.name === "OrderCreated").args[0];

        // Advance EVM time past expiry
        await network.provider.send("evm_increaseTime", [200]);
        await network.provider.send("evm_mine");

        const aliceStock2 = await stock.balanceOf(alice.address);
        // Keeper (non-owner) calls refundExpired
        await (await book.connect(keeper).refundExpired(id2)).wait();
        expect(await stock.balanceOf(alice.address)).to.equal(aliceStock2 + stockIn);

        // 3. Cancel DCA plan and refund unspent budget
        const buyAmount = ethers.parseUnits("25", 6);
        await (await usdc.connect(alice).approve(book.target, buyAmount * 3n)).wait();
        const tx3 = await book.connect(alice).createDca(stock.target, buyAmount, 3, 3600, (curPrice * 120n) / 100n);
        const planId = (await tx3.wait()).logs.find((x) => x.fragment && x.fragment.name === "DcaCreated").args[0];

        // Execute 1 buy
        await (await book.connect(keeper).executeDca(planId)).wait();

        // Alice cancels plan -> 2 unspent buys ($50) refunded
        const aliceUsdcBefore = await usdc.balanceOf(alice.address);
        await (await book.connect(alice).cancelDca(planId)).wait();
        expect(await usdc.balanceOf(alice.address)).to.equal(aliceUsdcBefore + buyAmount * 2n);
      });
    });
  }
});
