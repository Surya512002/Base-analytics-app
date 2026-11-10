const { expect } = require("chai");
const { ethers } = require("hardhat");
const { require: tsxRequire } = require("tsx/cjs/api");

const calls = tsxRequire("../../src/lib/limitOrders/calls.ts", __filename);
const orderMath = tsxRequire("../../src/lib/limitOrders/orderMath.ts", __filename);

const P8 = (usd) => BigInt(Math.round(usd * 1e8));
const STOCK8 = (n) => ethers.parseUnits(String(n), 8);
const USDC6 = (n) => ethers.parseUnits(String(n), 6);

describe("S3: 8-Decimal Stock Tokens Math & Calls Parity (Hardhat Node)", () => {
  async function deploy8DecFixture() {
    const [owner, user, keeper] = await ethers.getSigners();
    const ERC = await ethers.getContractFactory("MockERC20");

    // 8 decimals stock token (like mAAPL, mMSFT, mGOOGL)
    const stock = await ERC.deploy("Mock Apple Inc", "mAAPL", 8);
    // 6 decimals quote token (mUSDC)
    const usdc = await ERC.deploy("Mock USD Coin", "mUSDC", 6);

    const initialPrice = 343; // $343.00
    const feed = await (await ethers.getContractFactory("MockFeed")).deploy(P8(initialPrice));
    const adapter = await (await ethers.getContractFactory("MockAdapter")).deploy();
    const book = await (await ethers.getContractFactory("LimitOrderBook")).deploy(usdc.target, owner.address, 10);

    // Setup market: maxStockIn = 0.3 stock ($102.90 cap), maxQuoteIn = 100 USDC ($100 cap), maxDev = 500 bps (5%)
    await book.setMarket(
      stock.target,
      feed.target,
      604800,
      adapter.target,
      STOCK8(0.3),
      USDC6(100),
      500,
      true
    );

    // Set adapter rates with general formula
    const setRateAndPrice = async (usd) => {
      const p = P8(usd);
      const sellNum = p * 10n ** 6n;
      const sellDen = 10n ** 8n * 100_000_000n;
      const buyNum = 10n ** 8n * 100_000_000n;
      const buyDen = p * 10n ** 6n;

      await adapter.setRate(stock.target, usdc.target, sellNum, sellDen);
      await adapter.setRate(usdc.target, stock.target, buyNum, buyDen);
      await feed.setAnswer(p);
    };

    await setRateAndPrice(initialPrice);

    // Fund adapter with inventory
    await stock.mint(adapter.target, STOCK8(100_000));
    await usdc.mint(adapter.target, USDC6(500_000));

    // Fund user
    await stock.mint(user.address, STOCK8(10));
    await usdc.mint(user.address, USDC6(5_000));

    return { owner, user, keeper, stock, usdc, feed, adapter, book, setRateAndPrice };
  }

  describe("orderMath with 8-decimal stock & 6-decimal quote", () => {
    it("computes exact expected amount out for LIMIT_SELL (stock -> quote)", () => {
      // 0.20 mAAPL at $343 = 68.60 mUSDC
      const stockIn = STOCK8(0.2); // 20_000_000n
      const trigger = P8(343); // 343_00000000n
      const expected = orderMath.expectedAmountOut("LIMIT_SELL", stockIn, trigger, 8, 6);
      expect(expected).to.equal(68_600_000n); // 68.60 mUSDC
    });

    it("computes exact expected amount out for LIMIT_BUY (quote -> stock)", () => {
      // 68.60 mUSDC at $343 buys 0.20 mAAPL
      const quoteIn = 68_600_000n;
      const trigger = P8(343);
      const expected = orderMath.expectedAmountOut("LIMIT_BUY", quoteIn, trigger, 8, 6);
      expect(expected).to.equal(20_000_000n); // 0.20 mAAPL
    });

    it("computes exact fill floor with 500 bps (5%) max deviation", () => {
      const quoteIn = 100_000_000n; // 100 mUSDC
      const price = P8(200); // $200 -> 0.50 stock = 50_000_000n
      const floor = orderMath.fillFloor("LIMIT_BUY", quoteIn, price, 8, 6, 500);
      // 50_000_000 * 9500 / 10000 = 47_500_000n (0.475 mAAPL)
      expect(floor).to.equal(47_500_000n);
    });
  });

  describe("calls.ts on-chain execution with 8-decimal stock", () => {
    it("executes LIMIT_BUY order created via calls.ts and verifies keeper fill", async () => {
      const { user, keeper, stock, usdc, book, setRateAndPrice } = await deploy8DecFixture();

      const config = {
        orderBook: book.target,
        quoteToken: { address: usdc.target },
        markets: [{ stockToken: stock.target }],
      };

      // 1. Approve exact quote tokens
      const amountIn = USDC6(34); // 34 mUSDC
      const triggerPrice = P8(340); // $340
      const minOut = 9_500_000n; // 0.095 mAAPL
      const expiry = Math.floor(Date.now() / 1000) + 86400;

      const approveTx = calls.buildApproveCall(usdc.target, book.target, amountIn);
      calls.assertAllowedLimitOrderTx(approveTx, config, amountIn);
      await user.sendTransaction({ to: approveTx.to, data: approveTx.data });

      // 2. Create LIMIT_BUY order
      const orderTx = calls.buildCreateOrderCall({
        orderBook: book.target,
        stockToken: stock.target,
        orderType: 0,
        amountIn,
        triggerPrice,
        minAmountOut: minOut,
        expiry,
      });
      calls.assertAllowedLimitOrderTx(orderTx, config);
      await user.sendTransaction({ to: orderTx.to, data: orderTx.data });

      const orderId = (await book.nextOrderId()) - 1n;
      expect(await book.canExecute(orderId)).to.be.false;

      // 3. Move price to $335 (triggers buy)
      await setRateAndPrice(335);
      expect(await book.canExecute(orderId)).to.be.true;

      // 4. Keeper executes
      const userStockBefore = await stock.balanceOf(user.address);
      await book.connect(keeper).executeOrder(orderId);
      const userStockAfter = await stock.balanceOf(user.address);

      const received = userStockAfter - userStockBefore;
      expect(received).to.be.gt(minOut);
      // At $335, 34 USDC / 335 = 0.10149253 mAAPL minus 0.1% fee = 0.10139104 mAAPL
      expect(received).to.equal(10_139_104n);

      const finalOrder = await book.getOrder(orderId);
      expect(finalOrder.status).to.equal(2); // EXECUTED
    });

    it("executes LIMIT_SELL order created via calls.ts with 8-decimal stock", async () => {
      const { user, keeper, stock, usdc, book, setRateAndPrice } = await deploy8DecFixture();

      const config = {
        orderBook: book.target,
        quoteToken: { address: usdc.target },
        markets: [{ stockToken: stock.target }],
      };

      // Sell 0.10 mAAPL when price reaches $360
      const amountIn = STOCK8(0.1); // 10_000_000n (0.10 mAAPL)
      const triggerPrice = P8(360); // $360
      const minOut = USDC6(35); // 35 mUSDC
      const expiry = Math.floor(Date.now() / 1000) + 86400;

      const approveTx = calls.buildApproveCall(stock.target, book.target, amountIn);
      calls.assertAllowedLimitOrderTx(approveTx, config, amountIn);
      await user.sendTransaction({ to: approveTx.to, data: approveTx.data });

      const orderTx = calls.buildCreateOrderCall({
        orderBook: book.target,
        stockToken: stock.target,
        orderType: 1, // LIMIT_SELL
        amountIn,
        triggerPrice,
        minAmountOut: minOut,
        expiry,
      });
      calls.assertAllowedLimitOrderTx(orderTx, config);
      await user.sendTransaction({ to: orderTx.to, data: orderTx.data });

      const orderId = (await book.nextOrderId()) - 1n;
      expect(await book.canExecute(orderId)).to.be.false;

      // Move price to $365 (exceeds take-profit trigger)
      await setRateAndPrice(365);
      expect(await book.canExecute(orderId)).to.be.true;

      const userUsdcBefore = await usdc.balanceOf(user.address);
      await book.connect(keeper).executeOrder(orderId);
      const userUsdcAfter = await usdc.balanceOf(user.address);

      const receivedUsdc = userUsdcAfter - userUsdcBefore;
      expect(receivedUsdc).to.be.gte(minOut);
      // 0.10 mAAPL * $365 = 36.50 USDC minus 10 bps fee = 36.4635 USDC
      expect(receivedUsdc).to.equal(36_463_500n);
    });
  });
});
