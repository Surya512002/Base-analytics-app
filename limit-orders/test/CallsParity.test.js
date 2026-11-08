const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { decodeEventLog } = require("viem");
const { require: tsxRequire } = require("tsx/cjs/api");

const calls = tsxRequire("../../src/lib/limitOrders/calls.ts", __filename);
const { mapOrderError, ERROR_MESSAGES } = tsxRequire("../../src/lib/limitOrders/errorMapper.ts", __filename);
const { groupOrders } = tsxRequire("../../src/lib/limitOrders/bracketGrouping.ts", __filename);
const { orderBookAbi } = tsxRequire("../../src/lib/limitOrders/abi.ts", __filename);

const P = (usd) => BigInt(Math.round(usd * 1e8));
const STOCK = (n) => ethers.parseUnits(String(n), 18);
const USDC = (n) => ethers.parseUnits(String(n), 6);
const DAY = 86400;

describe("Part 2: UI Calls Parity & Custom Errors Verification", () => {
  async function deployFixture() {
    const [owner, user, keeper, other] = await ethers.getSigners();
    const ERC = await ethers.getContractFactory("MockERC20");
    const stock = await ERC.deploy("Mock NVDA", "mNVDA", 18);
    const usdc = await ERC.deploy("Mock USD Coin", "USDC", 6);
    const feed = await (await ethers.getContractFactory("MockFeed")).deploy(P(100));
    const adapter = await (await ethers.getContractFactory("MockAdapter")).deploy();
    const book = await (await ethers.getContractFactory("LimitOrderBook")).deploy(usdc.target, owner.address, 15);

    // Setup market: maxStockIn = 1 stock ($100), maxQuoteIn = 100 USDC ($100), maxDeviation = 300 bps (3%), staleness = 3600s
    await book.setMarket(
      stock.target,
      feed.target,
      3600,
      adapter.target,
      STOCK(1),
      USDC(100),
      300,
      true
    );

    // Fund adapter for swaps
    await stock.mint(adapter.target, STOCK(1000));
    await usdc.mint(adapter.target, USDC(100000));

    const setPrice = async (usd) => {
      await feed.setAnswer(P(usd));
      await adapter.setRate(usdc.target, stock.target, 10n ** 20n, P(usd));
      await adapter.setRate(stock.target, usdc.target, P(usd), 10n ** 20n);
    };
    await setPrice(100);

    // Fund user
    await stock.mint(user.address, STOCK(10));
    await usdc.mint(user.address, USDC(1000));

    // User approves order book using raw calls.ts buildApproveCall
    const approveStock = calls.buildApproveCall(stock.target, book.target);
    await user.sendTransaction({ to: approveStock.to, data: approveStock.data });

    const approveUsdc = calls.buildApproveCall(usdc.target, book.target);
    await user.sendTransaction({ to: approveUsdc.to, data: approveUsdc.data });

    return { owner, user, keeper, other, stock, usdc, feed, adapter, book, setPrice };
  }

  function decodeLog(receipt, eventName) {
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: orderBookAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === eventName) {
          return decoded.args;
        }
      } catch {
        // Not matching event ABI
      }
    }
    throw new Error(`Event ${eventName} not found in transaction logs`);
  }

  describe("2.2 Local Hardhat parity test with calls.ts", () => {
    it("creates a Limit Buy using calls.ts and validates state & event", async () => {
      const { user, stock, usdc, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // Limit buy: deposit 50 USDC at trigger $90
      const txReq = calls.buildCreateOrderCall({
        orderBook: book.target,
        stockToken: stock.target,
        orderType: 0, // LIMIT_BUY
        amountIn: USDC(50),
        triggerPrice: P(90),
        minAmountOut: STOCK(0.55),
        expiry,
      });

      const tx = await user.sendTransaction({ to: txReq.to, data: txReq.data });
      const receipt = await tx.wait();
      const eventArgs = decodeLog(receipt, "OrderCreated");

      expect(eventArgs.id).to.equal(1n);
      expect(eventArgs.owner.toLowerCase()).to.equal(user.address.toLowerCase());
      expect(eventArgs.stockToken.toLowerCase()).to.equal(stock.target.toLowerCase());
      expect(eventArgs.orderType).to.equal(0);
      expect(eventArgs.amountIn).to.equal(USDC(50));
      expect(eventArgs.triggerPrice).to.equal(P(90));

      const onChain = await book.getOrder(1);
      expect(onChain.owner).to.equal(user.address);
      expect(onChain.amountIn).to.equal(USDC(50));
      expect(onChain.orderType).to.equal(0);
      expect(onChain.status).to.equal(1); // OPEN
    });

    it("creates a Take-Profit (Limit Sell) using calls.ts and validates state", async () => {
      const { user, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // Take-profit: deposit 0.5 stock at trigger $120
      const txReq = calls.buildCreateOrderCall({
        orderBook: book.target,
        stockToken: stock.target,
        orderType: 1, // LIMIT_SELL
        amountIn: STOCK(0.5),
        triggerPrice: P(120),
        minAmountOut: USDC(59),
        expiry,
      });

      const tx = await user.sendTransaction({ to: txReq.to, data: txReq.data });
      const receipt = await tx.wait();
      const eventArgs = decodeLog(receipt, "OrderCreated");

      expect(eventArgs.id).to.equal(1n);
      expect(eventArgs.orderType).to.equal(1);
      expect(eventArgs.triggerPrice).to.equal(P(120));

      const onChain = await book.getOrder(1);
      expect(onChain.amountIn).to.equal(STOCK(0.5));
      expect(onChain.status).to.equal(1); // OPEN
    });

    it("creates a Stop-Loss using calls.ts and validates state", async () => {
      const { user, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // Stop-loss: deposit 0.5 stock at trigger $80
      const txReq = calls.buildCreateOrderCall({
        orderBook: book.target,
        stockToken: stock.target,
        orderType: 2, // STOP_LOSS
        amountIn: STOCK(0.5),
        triggerPrice: P(80),
        minAmountOut: USDC(39),
        expiry,
      });

      const tx = await user.sendTransaction({ to: txReq.to, data: txReq.data });
      const receipt = await tx.wait();
      const eventArgs = decodeLog(receipt, "OrderCreated");

      expect(eventArgs.id).to.equal(1n);
      expect(eventArgs.orderType).to.equal(2);
      expect(eventArgs.triggerPrice).to.equal(P(80));
    });

    it("creates a Trailing Stop using calls.ts and validates peak & trailBps", async () => {
      const { user, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // Trailing stop: 500 bps (5%), current oracle price = $100 -> stop = $95
      const txReq = calls.buildCreateTrailingStopCall({
        orderBook: book.target,
        stockToken: stock.target,
        amountIn: STOCK(0.5),
        trailBps: 500,
        minAmountOut: USDC(45),
        expiry,
      });

      const tx = await user.sendTransaction({ to: txReq.to, data: txReq.data });
      const receipt = await tx.wait();
      const eventArgs = decodeLog(receipt, "OrderCreated");

      expect(eventArgs.id).to.equal(1n);
      expect(eventArgs.orderType).to.equal(3); // TRAILING_STOP
      expect(eventArgs.triggerPrice).to.equal(P(95)); // Initial stop = $95

      const onChain = await book.getOrder(1);
      expect(onChain.trailBps).to.equal(500);
      expect(onChain.peakPrice).to.equal(P(100));
    });

    it("creates a Bracket (Take-Profit + Stop-Loss) using calls.ts", async () => {
      const { user, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // Bracket: 0.5 stock escrowed once, TP=$120, SL=$80
      const txReq = calls.buildCreateBracketCall({
        orderBook: book.target,
        stockToken: stock.target,
        amountIn: STOCK(0.5),
        takeProfitPrice: P(120),
        stopLossPrice: P(80),
        minOutTakeProfit: USDC(59),
        minOutStopLoss: USDC(39),
        expiry,
      });

      const tx = await user.sendTransaction({ to: txReq.to, data: txReq.data });
      const receipt = await tx.wait();
      const bracketArgs = decodeLog(receipt, "BracketCreated");

      expect(bracketArgs.takeProfitId).to.equal(1n);
      expect(bracketArgs.stopLossId).to.equal(2n);

      const tpLeg = await book.getOrder(1);
      const slLeg = await book.getOrder(2);

      expect(tpLeg.orderType).to.equal(1); // LIMIT_SELL
      expect(tpLeg.triggerPrice).to.equal(P(120));
      expect(tpLeg.linkedId).to.equal(2n);

      expect(slLeg.orderType).to.equal(2); // STOP_LOSS
      expect(slLeg.triggerPrice).to.equal(P(80));
      expect(slLeg.linkedId).to.equal(1n);
    });

    it("tests high-level form encoders from calls.ts", async () => {
      const { user, stock, usdc, book } = await loadFixture(deployFixture);

      // Form encoder for limit buy
      const formBuyReq = calls.encodeFormCreateOrder({
        orderBook: book.target,
        stockToken: stock.target,
        orderType: 0,
        amountStr: "50",
        inDecimals: 6,
        triggerStr: "90",
        slippagePercent: 1,
        stockDecimals: 18,
        quoteDecimals: 6,
        keeperFeeBps: 15,
        expirySeconds: 86400,
      });
      const tx1 = await user.sendTransaction({ to: formBuyReq.to, data: formBuyReq.data });
      await tx1.wait();
      expect(await book.nextOrderId()).to.equal(2n);

      // Form encoder for trailing stop
      const formTrailingReq = calls.encodeFormCreateTrailingStop({
        orderBook: book.target,
        stockToken: stock.target,
        amountStr: "0.5",
        inDecimals: 18,
        trailPercent: 5,
        slippagePercent: 1,
        currentPrice: P(100),
        stockDecimals: 18,
        quoteDecimals: 6,
        keeperFeeBps: 15,
        expirySeconds: 86400,
      });
      const tx2 = await user.sendTransaction({ to: formTrailingReq.to, data: formTrailingReq.data });
      await tx2.wait();
      expect(await book.nextOrderId()).to.equal(3n);

      // Form encoder for bracket
      const formBracketReq = calls.encodeFormCreateBracket({
        orderBook: book.target,
        stockToken: stock.target,
        amountStr: "0.4",
        inDecimals: 18,
        takeProfitStr: "130",
        stopLossStr: "85",
        slippagePercent: 1,
        stockDecimals: 18,
        quoteDecimals: 6,
        keeperFeeBps: 15,
        expirySeconds: 86400,
      });
      const tx3 = await user.sendTransaction({ to: formBracketReq.to, data: formBracketReq.data });
      await tx3.wait();
      expect(await book.nextOrderId()).to.equal(5n);

      // Form encoder for DCA
      const formDcaReq = calls.encodeFormCreateDca({
        orderBook: book.target,
        stockToken: stock.target,
        amountPerBuyStr: "25",
        quoteDecimals: 6,
        buys: 4,
        intervalSeconds: 3600,
        ceilingPriceStr: "110",
      });
      const tx4 = await user.sendTransaction({ to: formDcaReq.to, data: formDcaReq.data });
      await tx4.wait();
      expect(await book.nextPlanId()).to.equal(2n);
    });

    it("edits an order in place using buildUpdateOrderCall", async () => {
      const { user, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // Create take profit at $120
      const createReq = calls.buildCreateOrderCall({
        orderBook: book.target,
        stockToken: stock.target,
        orderType: 1,
        amountIn: STOCK(0.5),
        triggerPrice: P(120),
        minAmountOut: USDC(59),
        expiry,
      });
      await (await user.sendTransaction({ to: createReq.to, data: createReq.data })).wait();

      // Edit in place: new trigger $125, new minAmountOut $61
      const updateReq = calls.buildUpdateOrderCall({
        orderBook: book.target,
        orderId: 1n,
        newTrigger: P(125),
        newMinAmountOut: USDC(61),
      });

      const tx = await user.sendTransaction({ to: updateReq.to, data: updateReq.data });
      const receipt = await tx.wait();
      const updateArgs = decodeLog(receipt, "OrderUpdated");

      expect(updateArgs.id).to.equal(1n);
      expect(updateArgs.triggerPrice).to.equal(P(125));
      expect(updateArgs.minAmountOut).to.equal(USDC(61));

      const onChain = await book.getOrder(1);
      expect(onChain.triggerPrice).to.equal(P(125));
      expect(onChain.minAmountOut).to.equal(USDC(61));
    });

    it("cancels an order using buildCancelOrderCall and refunds deposit", async () => {
      const { user, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      const userStockBefore = await stock.balanceOf(user.address);

      const createReq = calls.buildCreateOrderCall({
        orderBook: book.target,
        stockToken: stock.target,
        orderType: 1,
        amountIn: STOCK(0.5),
        triggerPrice: P(120),
        minAmountOut: USDC(59),
        expiry,
      });
      await (await user.sendTransaction({ to: createReq.to, data: createReq.data })).wait();
      expect(await stock.balanceOf(user.address)).to.equal(userStockBefore - STOCK(0.5));

      // Cancel order
      const cancelReq = calls.buildCancelOrderCall(book.target, 1n);
      const tx = await user.sendTransaction({ to: cancelReq.to, data: cancelReq.data });
      const receipt = await tx.wait();
      const cancelArgs = decodeLog(receipt, "OrderCancelled");

      expect(cancelArgs.id).to.equal(1n);
      expect(cancelArgs.owner.toLowerCase()).to.equal(user.address.toLowerCase());

      const onChain = await book.getOrder(1);
      expect(onChain.status).to.equal(3); // CANCELLED
      // Verify exact refund
      expect(await stock.balanceOf(user.address)).to.equal(userStockBefore);
    });

    it("refunds an expired order using buildRefundExpiredCall", async () => {
      const { user, other, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + 3600;

      const userStockBefore = await stock.balanceOf(user.address);

      const createReq = calls.buildCreateOrderCall({
        orderBook: book.target,
        stockToken: stock.target,
        orderType: 1,
        amountIn: STOCK(0.5),
        triggerPrice: P(120),
        minAmountOut: USDC(59),
        expiry,
      });
      await (await user.sendTransaction({ to: createReq.to, data: createReq.data })).wait();

      // Fast-forward time past expiry
      await time.increase(3601);

      // Callable by anyone (here 'other')
      const refundReq = calls.buildRefundExpiredCall(book.target, 1n);
      const tx = await other.sendTransaction({ to: refundReq.to, data: refundReq.data });
      const receipt = await tx.wait();
      const expiredArgs = decodeLog(receipt, "OrderExpired");

      expect(expiredArgs.id).to.equal(1n);
      expect(expiredArgs.owner.toLowerCase()).to.equal(user.address.toLowerCase());

      const onChain = await book.getOrder(1);
      expect(onChain.status).to.equal(4); // EXPIRED
      // Verify user received refund
      expect(await stock.balanceOf(user.address)).to.equal(userStockBefore);
    });

    it("creates a DCA plan and cancels using buildCancelDcaCall", async () => {
      const { user, stock, usdc, book } = await loadFixture(deployFixture);
      const userUsdcBefore = await usdc.balanceOf(user.address);

      // Create DCA plan: 4 buys of 25 USDC = 100 USDC escrowed
      const dcaReq = calls.buildCreateDcaCall({
        orderBook: book.target,
        stockToken: stock.target,
        amountPerBuy: USDC(25),
        buys: 4,
        interval: 3600,
        maxPrice: P(120),
      });

      const txCreate = await user.sendTransaction({ to: dcaReq.to, data: dcaReq.data });
      const receiptCreate = await txCreate.wait();
      const dcaArgs = decodeLog(receiptCreate, "DcaCreated");

      expect(dcaArgs.id).to.equal(1n);
      expect(dcaArgs.amountPerBuy).to.equal(USDC(25));
      expect(dcaArgs.buys).to.equal(4n);

      expect(await usdc.balanceOf(user.address)).to.equal(userUsdcBefore - USDC(100));

      // Cancel DCA plan
      const cancelReq = calls.buildCancelDcaCall(book.target, 1n);
      const txCancel = await user.sendTransaction({ to: cancelReq.to, data: cancelReq.data });
      const receiptCancel = await txCancel.wait();
      const cancelArgs = decodeLog(receiptCancel, "DcaCancelled");

      expect(cancelArgs.id).to.equal(1n);
      expect(cancelArgs.refunded).to.equal(USDC(100));
      expect(await usdc.balanceOf(user.address)).to.equal(userUsdcBefore);

      const plan = await book.getPlan(1);
      expect(plan.status).to.equal(3); // CANCELLED
    });

    it("verifies read mapping, tuple order for markets(), and canExecute logic", async () => {
      const { user, stock, feed, adapter, book, setPrice } = await loadFixture(deployFixture);

      // 1. Check markets() tuple order
      // markets(address) returns:
      // (address feed, uint8 feedDecimals, uint8 stockDecimals, bool enabled, uint32 maxStaleness, uint16 maxDeviationBps, address adapter, uint128 maxStockIn, uint128 maxQuoteIn)
      const m = await book.markets(stock.target);
      expect(m[0].toLowerCase()).to.equal(feed.target.toLowerCase()); // feed
      expect(m[1]).to.equal(8); // feedDecimals
      expect(m[2]).to.equal(18); // stockDecimals
      expect(m[3]).to.equal(true); // enabled
      expect(m[4]).to.equal(3600); // maxStaleness
      expect(m[5]).to.equal(300); // maxDeviationBps
      expect(m[6].toLowerCase()).to.equal(adapter.target.toLowerCase()); // adapter
      expect(m[7]).to.equal(STOCK(1)); // maxStockIn
      expect(m[8]).to.equal(USDC(100)); // maxQuoteIn

      // Named properties if returned by ethers
      expect(m.feed.toLowerCase()).to.equal(feed.target.toLowerCase());
      expect(m.stockDecimals).to.equal(18);
      expect(m.enabled).to.equal(true);
      expect(m.adapter.toLowerCase()).to.equal(adapter.target.toLowerCase());
      expect(m.maxStockIn).to.equal(STOCK(1));
      expect(m.maxQuoteIn).to.equal(USDC(100));

      // 2. Decode getOrder and getOrdersRange
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;
      const createReq = calls.buildCreateOrderCall({
        orderBook: book.target,
        stockToken: stock.target,
        orderType: 0, // LIMIT_BUY
        amountIn: USDC(50),
        triggerPrice: P(90),
        minAmountOut: STOCK(0.55),
        expiry,
      });
      await (await user.sendTransaction({ to: createReq.to, data: createReq.data })).wait();

      const order1 = await book.getOrder(1);
      expect(order1.owner).to.equal(user.address);
      expect(order1.triggerPrice).to.equal(P(90));
      expect(order1.amountIn).to.equal(USDC(50));

      const [rangeIds, rangeList] = await book.getOrdersRange(1, 1);
      expect(rangeIds.length).to.equal(1);
      expect(rangeIds[0]).to.equal(1n);
      expect(rangeList[0].owner).to.equal(user.address);

      // 3. canExecute returns false when oracle price ($100) > trigger price ($90)
      expect(await book.canExecute(1)).to.equal(false);

      // Lower price to $89 -> canExecute becomes true
      await setPrice(89);
      expect(await book.canExecute(1)).to.equal(true);

      // Reset feed price
      await setPrice(100);
    });

    it("verifies bracket grouping logic with groupOrders", async () => {
      const { user, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // Create bracket
      const bReq = calls.buildCreateBracketCall({
        orderBook: book.target,
        stockToken: stock.target,
        amountIn: STOCK(0.5),
        takeProfitPrice: P(120),
        stopLossPrice: P(80),
        minOutTakeProfit: USDC(59),
        minOutStopLoss: USDC(39),
        expiry,
      });
      await (await user.sendTransaction({ to: bReq.to, data: bReq.data })).wait();

      const tpLeg = await book.getOrder(1);
      const slLeg = await book.getOrder(2);

      const rawOrders = [
        {
          id: 1n,
          owner: tpLeg[0],
          expiry: Number(tpLeg[1]),
          orderType: Number(tpLeg[2]),
          status: Number(tpLeg[3]),
          trailBps: Number(tpLeg[4]),
          stockToken: tpLeg[5],
          triggerPrice: BigInt(tpLeg[6]),
          amountIn: BigInt(tpLeg[7]),
          minAmountOut: BigInt(tpLeg[8]),
          peakPrice: BigInt(tpLeg[9]),
          linkedId: BigInt(tpLeg[10]),
        },
        {
          id: 2n,
          owner: slLeg[0],
          expiry: Number(slLeg[1]),
          orderType: Number(slLeg[2]),
          status: Number(slLeg[3]),
          trailBps: Number(slLeg[4]),
          stockToken: slLeg[5],
          triggerPrice: BigInt(slLeg[6]),
          amountIn: BigInt(slLeg[7]),
          minAmountOut: BigInt(slLeg[8]),
          peakPrice: BigInt(slLeg[9]),
          linkedId: BigInt(slLeg[10]),
        },
      ];

      const { open, history } = groupOrders(rawOrders);
      expect(open.length).to.equal(1);
      expect(history.length).to.equal(0);
      expect(open[0].kind).to.equal("bracket");
      expect(open[0].takeProfitLeg.id).to.equal(1n);
      expect(open[0].stopLossLeg.id).to.equal(2n);
    });
  });

  describe("2.3 Custom errors revert test & user-facing message mapping", () => {
    async function assertRevertsWithMappedError(txPromise, errorName) {
      let threw = false;
      try {
        await txPromise;
      } catch (err) {
        threw = true;
        const msg = mapOrderError(err);
        const expected = ERROR_MESSAGES[errorName];
        expect(expected, `Expected message definition for ${errorName}`).to.not.be.undefined;
        expect(msg).to.equal(expected);
      }
      expect(threw, `Expected transaction to revert with ${errorName}`).to.be.true;
    }

    it("triggers AmountTooLarge and maps correctly", async () => {
      const { user, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // Max is 1 stock, try 1.1 stock
      const p = book.connect(user).createOrder(stock.target, 2, STOCK(1.1), P(80), USDC(30), expiry);
      await assertRevertsWithMappedError(p, "AmountTooLarge");
    });

    it("triggers AlreadyTriggered and maps correctly", async () => {
      const { user, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // Oracle price = $100. Limit buy with trigger $105 triggers immediately!
      const p = book.connect(user).createOrder(stock.target, 0, USDC(50), P(105), STOCK(0.4), expiry);
      await assertRevertsWithMappedError(p, "AlreadyTriggered");
    });

    it("triggers InvalidParams and maps correctly", async () => {
      const { user, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // Amount = 0
      const p = book.connect(user).createOrder(stock.target, 0, 0, P(90), STOCK(0.4), expiry);
      await assertRevertsWithMappedError(p, "InvalidParams");
    });

    it("triggers InvalidExpiry and maps correctly", async () => {
      const { user, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      // Past expiry
      const p = book.connect(user).createOrder(stock.target, 0, USDC(50), P(90), STOCK(0.4), latestBlock.timestamp - 1);
      await assertRevertsWithMappedError(p, "InvalidExpiry");
    });

    it("triggers InvalidBracket and maps correctly", async () => {
      const { user, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // TP must be > current ($100) and SL < current ($100), and TP > SL. If TP <= SL:
      const p = book.connect(user).createBracket(stock.target, STOCK(0.5), P(80), P(120), USDC(39), USDC(59), expiry);
      await assertRevertsWithMappedError(p, "InvalidBracket");
    });

    it("triggers MarketDisabled and maps correctly", async () => {
      const { user, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // Random non-configured stock address
      const dummyStock = "0x1111111111111111111111111111111111111111";
      const p = book.connect(user).createOrder(dummyStock, 0, USDC(50), P(90), STOCK(0.4), expiry);
      await assertRevertsWithMappedError(p, "MarketDisabled");
    });

    it("triggers NotOwner and maps correctly", async () => {
      const { user, other, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // User creates order #1
      await (await book.connect(user).createOrder(stock.target, 0, USDC(50), P(90), STOCK(0.4), expiry)).wait();

      // Other tries to cancel user's order
      const p = book.connect(other).cancelOrder(1);
      await assertRevertsWithMappedError(p, "NotOwner");
    });

    it("triggers NotOpen and maps correctly", async () => {
      const { user, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      await (await book.connect(user).createOrder(stock.target, 0, USDC(50), P(90), STOCK(0.4), expiry)).wait();
      // Cancel once
      await (await book.connect(user).cancelOrder(1)).wait();

      // Try to cancel again -> NotOpen
      const p = book.connect(user).cancelOrder(1);
      await assertRevertsWithMappedError(p, "NotOpen");
    });

    it("triggers NotExpired and maps correctly", async () => {
      const { user, other, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      await (await book.connect(user).createOrder(stock.target, 0, USDC(50), P(90), STOCK(0.4), expiry)).wait();

      // Try to refund before expiry -> NotExpired
      const p = book.connect(other).refundExpired(1);
      await assertRevertsWithMappedError(p, "NotExpired");
    });

    it("triggers OrderHasExpired and maps correctly", async () => {
      const { user, keeper, stock, book, setPrice } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + 3600;

      await (await book.connect(user).createOrder(stock.target, 0, USDC(50), P(90), STOCK(0.4), expiry)).wait();

      // Trigger condition met
      await setPrice(89);

      // Fast-forward past expiry
      await time.increase(3601);

      // Keeper tries to execute expired order -> OrderHasExpired
      const p = book.connect(keeper).executeOrder(1);
      await assertRevertsWithMappedError(p, "OrderHasExpired");
    });

    it("triggers StalePrice and maps correctly", async () => {
      const { user, keeper, stock, feed, book, setPrice } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + 86400;

      await (await book.connect(user).createOrder(stock.target, 0, USDC(50), P(90), STOCK(0.4), expiry)).wait();

      // Meet trigger
      await setPrice(89);

      // Set timestamp stale by > 3600 seconds
      await feed.setAnswerStale(P(89), latestBlock.timestamp - 4000);

      // Keeper tries to execute -> StalePrice
      const p = book.connect(keeper).executeOrder(1);
      await assertRevertsWithMappedError(p, "StalePrice");
    });

    it("triggers NotTriggered and maps correctly", async () => {
      const { user, keeper, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // Limit buy at $90, price is $100 -> NotTriggered
      await (await book.connect(user).createOrder(stock.target, 0, USDC(50), P(90), STOCK(0.4), expiry)).wait();

      const p = book.connect(keeper).executeOrder(1);
      await assertRevertsWithMappedError(p, "NotTriggered");
    });

    it("triggers Slippage and maps correctly", async () => {
      const { user, keeper, stock, book, setPrice } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // Deposit 0.5 stock at trigger $90, but require exactly $45 USDC output
      // Gross payout is 45 USDC. With keeperFeeBps = 15, net to owner is 45 * (1 - 0.0015) = 44.9325 < 45 USDC
      await (await book.connect(user).createOrder(stock.target, 2, STOCK(0.5), P(90), USDC(45), expiry)).wait();

      // Price drops to $90 (pool delivers exactly 45 USDC gross)
      await setPrice(90);

      const p = book.connect(keeper).executeOrder(1);
      await assertRevertsWithMappedError(p, "Slippage");
    });

    it("triggers FillBelowOracleBound and maps correctly", async () => {
      const { user, keeper, stock, usdc, feed, adapter, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // User creates stop-loss for 0.5 stock at $90 with loose user minAmountOut (USDC 30)
      await (await book.connect(user).createOrder(stock.target, 2, STOCK(0.5), P(90), USDC(30), expiry)).wait();

      // Price drops to $85. Oracle ideal is 0.5 * 85 = $42.50. Max deviation floor (3%) is 41.225 USDC.
      await feed.setAnswer(P(85));
      // Adapter is rigged to give only $75 per stock (0.5 stock gives only $37.50 USDC < 41.225 USDC)
      await adapter.setRate(stock.target, usdc.target, P(75), 10n ** 20n);

      const p = book.connect(keeper).executeOrder(1);
      await assertRevertsWithMappedError(p, "FillBelowOracleBound");
    });

    it("triggers EnforcedPause and maps correctly", async () => {
      const { owner, user, stock, book } = await loadFixture(deployFixture);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock.timestamp + DAY;

      // Owner pauses book
      await book.connect(owner).pause();

      // User attempts to create order while paused -> EnforcedPause
      const p = book.connect(user).createOrder(stock.target, 0, USDC(50), P(90), STOCK(0.4), expiry);
      await assertRevertsWithMappedError(p, "EnforcedPause");
    });
  });
});
