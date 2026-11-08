const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const P = (usd) => BigInt(Math.round(usd * 1e8)); // price with 8 decimals
const STOCK = (n) => ethers.parseUnits(String(n), 18);
const USDC = (n) => ethers.parseUnits(String(n), 6);
const T = { LIMIT_BUY: 0, LIMIT_SELL: 1, STOP_LOSS: 2 };
const S = { NONE: 0, OPEN: 1, EXECUTED: 2, CANCELLED: 3, EXPIRED: 4 };
const DAY = 86400;

async function deploy() {
  const [owner, alice, bob, keeper] = await ethers.getSigners();
  const ERC = await ethers.getContractFactory("MockERC20");
  const stock = await ERC.deploy("NVDA onchain", "NVDAc", 18);
  const usdc = await ERC.deploy("USD Coin", "USDC", 6);
  const feed = await (await ethers.getContractFactory("MockFeed")).deploy(P(100));
  const adapter = await (await ethers.getContractFactory("MockAdapter")).deploy();
  const book = await (await ethers.getContractFactory("LimitOrderBook")).deploy(usdc.target, owner.address, 10);

  await book.setMarket(stock.target, feed.target, 3600, adapter.target, STOCK(1000), USDC(100000), 500, true);

  // adapter inventory + user balances
  await stock.mint(adapter.target, STOCK(1_000_000));
  await usdc.mint(adapter.target, USDC(1_000_000_000));
  for (const u of [alice, bob]) {
    await stock.mint(u.address, STOCK(1000));
    await usdc.mint(u.address, USDC(100000));
    await stock.connect(u).approve(book.target, ethers.MaxUint256);
    await usdc.connect(u).approve(book.target, ethers.MaxUint256);
  }
  // rates: buy = USDC -> stock, sell = stock -> USDC (both depend on price P8)
  const setPrice = async (usd) => {
    await feed.setAnswer(P(usd));
    await adapter.setRate(usdc.target, stock.target, 10n ** 20n, P(usd));
    await adapter.setRate(stock.target, usdc.target, P(usd), 10n ** 20n);
  };
  await setPrice(100);
  return { owner, alice, bob, keeper, stock, usdc, feed, adapter, book, setPrice };
}

async function expiryIn(seconds) {
  return BigInt((await time.latest()) + seconds);
}

describe("LimitOrderBook", () => {
  describe("createOrder", () => {
    it("escrows tokens and stores the order (limit buy)", async () => {
      const { book, alice, usdc, stock } = await loadFixture(deploy);
      const exp = await expiryIn(DAY);
      await expect(book.connect(alice).createOrder(stock.target, T.LIMIT_BUY, USDC(900), P(90), STOCK(9), exp))
        .to.emit(book, "OrderCreated");
      expect(await usdc.balanceOf(book.target)).to.equal(USDC(900));
      const o = await book.getOrder(1);
      expect(o.owner).to.equal(alice.address);
      expect(o.status).to.equal(S.OPEN);
      expect(o.triggerPrice).to.equal(P(90));
      expect(await book.ordersOf(alice.address)).to.deep.equal([1n]);
    });

    it("escrows the stock for sells and stop-losses", async () => {
      const { book, alice, stock } = await loadFixture(deploy);
      const exp = await expiryIn(DAY);
      await book.connect(alice).createOrder(stock.target, T.LIMIT_SELL, STOCK(10), P(110), USDC(1000), exp);
      await book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(5), P(90), USDC(400), exp);
      expect(await stock.balanceOf(book.target)).to.equal(STOCK(15));
    });

    it("rejects orders that would trigger immediately", async () => {
      const { book, alice, stock } = await loadFixture(deploy); // price is $100
      const exp = await expiryIn(DAY);
      await expect(book.connect(alice).createOrder(stock.target, T.LIMIT_BUY, USDC(900), P(105), STOCK(1), exp))
        .to.be.revertedWithCustomError(book, "AlreadyTriggered");
      await expect(book.connect(alice).createOrder(stock.target, T.LIMIT_SELL, STOCK(1), P(95), USDC(1), exp))
        .to.be.revertedWithCustomError(book, "AlreadyTriggered");
      await expect(book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(1), P(100), USDC(1), exp))
        .to.be.revertedWithCustomError(book, "AlreadyTriggered");
    });

    it("validates params, expiry, caps and market", async () => {
      const { book, alice, stock, usdc } = await loadFixture(deploy);
      const exp = await expiryIn(DAY);
      await expect(book.connect(alice).createOrder(stock.target, T.STOP_LOSS, 0, P(90), 1, exp))
        .to.be.revertedWithCustomError(book, "InvalidParams");
      await expect(book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(1), 0, 1, exp))
        .to.be.revertedWithCustomError(book, "InvalidParams");
      await expect(book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(1), P(90), 0, exp))
        .to.be.revertedWithCustomError(book, "InvalidParams");
      await expect(book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(1), P(90), 1, BigInt(await time.latest())))
        .to.be.revertedWithCustomError(book, "InvalidExpiry");
      await expect(book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(1), P(90), 1, await expiryIn(91 * DAY)))
        .to.be.revertedWithCustomError(book, "InvalidExpiry");
      await expect(book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(1001), P(90), 1, exp))
        .to.be.revertedWithCustomError(book, "AmountTooLarge");
      await expect(book.connect(alice).createOrder(stock.target, T.LIMIT_BUY, USDC(100001), P(90), 1, exp))
        .to.be.revertedWithCustomError(book, "AmountTooLarge");
      await expect(book.connect(alice).createOrder(usdc.target, T.STOP_LOSS, 1, P(90), 1, exp))
        .to.be.revertedWithCustomError(book, "MarketDisabled");
    });

    it("is blocked while paused", async () => {
      const { book, alice, stock, owner } = await loadFixture(deploy);
      await book.connect(owner).pause();
      await expect(book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(1), P(90), 1, await expiryIn(DAY)))
        .to.be.revertedWithCustomError(book, "EnforcedPause");
    });
  });

  describe("executeOrder", () => {
    it("executes a limit buy when price <= trigger and pays the keeper fee", async () => {
      const { book, alice, keeper, stock, usdc, setPrice } = await loadFixture(deploy);
      await book.connect(alice).createOrder(stock.target, T.LIMIT_BUY, USDC(900), P(90), STOCK(9), await expiryIn(DAY));
      expect(await book.canExecute(1)).to.equal(false);
      await expect(book.connect(keeper).executeOrder(1)).to.be.revertedWithCustomError(book, "NotTriggered");

      await setPrice(89);
      expect(await book.canExecute(1)).to.equal(true);
      const gross = (USDC(900) * 10n ** 20n) / P(89);
      const fee = (gross * 10n) / 10000n;
      const before = await stock.balanceOf(alice.address);
      await expect(book.connect(keeper).executeOrder(1))
        .to.emit(book, "OrderExecuted")
        .withArgs(1, alice.address, keeper.address, P(89), USDC(900), gross - fee, fee);
      expect(await stock.balanceOf(alice.address) - before).to.equal(gross - fee);
      expect(await stock.balanceOf(keeper.address)).to.equal(fee);
      expect(await usdc.balanceOf(book.target)).to.equal(0);
      expect((await book.getOrder(1)).status).to.equal(S.EXECUTED);
    });

    it("executes a limit sell (take-profit) when price >= trigger", async () => {
      const { book, alice, keeper, stock, usdc, setPrice } = await loadFixture(deploy);
      await book.connect(alice).createOrder(stock.target, T.LIMIT_SELL, STOCK(10), P(110), USDC(1000), await expiryIn(DAY));
      await setPrice(109);
      await expect(book.connect(keeper).executeOrder(1)).to.be.revertedWithCustomError(book, "NotTriggered");
      await setPrice(111);
      const gross = USDC(1110);
      const fee = (gross * 10n) / 10000n;
      const before = await usdc.balanceOf(alice.address);
      await book.connect(keeper).executeOrder(1);
      expect(await usdc.balanceOf(alice.address) - before).to.equal(gross - fee);
      expect(await usdc.balanceOf(keeper.address)).to.equal(fee);
    });

    it("executes a stop-loss when price <= trigger", async () => {
      const { book, alice, keeper, stock, usdc, setPrice } = await loadFixture(deploy);
      await book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(10), P(90), USDC(800), await expiryIn(DAY));
      await setPrice(95);
      await expect(book.connect(keeper).executeOrder(1)).to.be.revertedWithCustomError(book, "NotTriggered");
      await setPrice(85);
      const before = await usdc.balanceOf(alice.address);
      await book.connect(keeper).executeOrder(1);
      const gross = USDC(850);
      expect(await usdc.balanceOf(alice.address) - before).to.equal(gross - (gross * 10n) / 10000n);
    });

    it("cannot be executed twice", async () => {
      const { book, alice, keeper, stock, setPrice } = await loadFixture(deploy);
      await book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(10), P(90), USDC(800), await expiryIn(DAY));
      await setPrice(85);
      await book.connect(keeper).executeOrder(1);
      await expect(book.connect(keeper).executeOrder(1)).to.be.revertedWithCustomError(book, "NotOpen");
    });

    it("blocks execution when the feed is stale (e.g. market closed)", async () => {
      const { book, alice, keeper, stock, feed, setPrice } = await loadFixture(deploy);
      await book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(10), P(90), USDC(800), await expiryIn(5 * DAY));
      await setPrice(85);
      await time.increase(3601);
      expect(await book.canExecute(1)).to.equal(false);
      await expect(book.connect(keeper).executeOrder(1)).to.be.revertedWithCustomError(book, "StalePrice");
      await feed.setAnswer(P(85)); // feed updates again
      expect(await book.canExecute(1)).to.equal(true);
      await book.connect(keeper).executeOrder(1);
    });

    it("reverts on slippage and leaves the order open", async () => {
      const { book, alice, keeper, stock, setPrice, adapter, usdc } = await loadFixture(deploy);
      // user wants at least 880 USDC after fees for 10 stock
      await book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(10), P(90), USDC(880), await expiryIn(DAY));
      await setPrice(85); // pool pays 850 < 880
      await expect(book.connect(keeper).executeOrder(1)).to.be.reverted;
      expect((await book.getOrder(1)).status).to.equal(S.OPEN);
      // pool price recovers to 89 -> 890 gross, 889.11 net >= 880
      await setPrice(89);
      await book.connect(keeper).executeOrder(1);
      expect((await book.getOrder(1)).status).to.equal(S.EXECUTED);
    });

    it("enforces minAmountOut on the amount AFTER the keeper fee", async () => {
      const { book, alice, keeper, stock, setPrice } = await loadFixture(deploy);
      // gross 850 USDC, net 849.15. minOut 850 should fail even though gross == 850
      await book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(10), P(90), USDC(850), await expiryIn(DAY));
      await setPrice(85);
      await expect(book.connect(keeper).executeOrder(1)).to.be.revertedWithCustomError(book, "Slippage");
    });

    it("does not execute expired orders and blocks execution while paused", async () => {
      const { book, alice, keeper, stock, setPrice, owner, feed } = await loadFixture(deploy);
      await book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(10), P(90), USDC(800), await expiryIn(DAY));
      await setPrice(85);
      await book.connect(owner).pause();
      await expect(book.connect(keeper).executeOrder(1)).to.be.revertedWithCustomError(book, "EnforcedPause");
      expect(await book.canExecute(1)).to.equal(false);
      await book.connect(owner).unpause();
      await time.increase(DAY + 10);
      await feed.setAnswer(P(85));
      await expect(book.connect(keeper).executeOrder(1)).to.be.revertedWithCustomError(book, "OrderHasExpired");
    });
  });

  describe("cancel and refund", () => {
    it("lets only the owner cancel and refunds the deposit", async () => {
      const { book, alice, bob, stock, usdc } = await loadFixture(deploy);
      await book.connect(alice).createOrder(stock.target, T.LIMIT_BUY, USDC(900), P(90), STOCK(9), await expiryIn(DAY));
      await expect(book.connect(bob).cancelOrder(1)).to.be.revertedWithCustomError(book, "NotOwner");
      const before = await usdc.balanceOf(alice.address);
      await expect(book.connect(alice).cancelOrder(1)).to.emit(book, "OrderCancelled");
      expect(await usdc.balanceOf(alice.address) - before).to.equal(USDC(900));
      expect((await book.getOrder(1)).status).to.equal(S.CANCELLED);
      await expect(book.connect(alice).cancelOrder(1)).to.be.revertedWithCustomError(book, "NotOpen");
    });

    it("allows cancelling while paused (users can always exit)", async () => {
      const { book, alice, owner, stock } = await loadFixture(deploy);
      await book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(10), P(90), USDC(800), await expiryIn(DAY));
      await book.connect(owner).pause();
      await book.connect(alice).cancelOrder(1);
      expect(await stock.balanceOf(alice.address)).to.equal(STOCK(1000));
    });

    it("refunds expired orders to the owner, callable by anyone, only after expiry", async () => {
      const { book, alice, bob, stock } = await loadFixture(deploy);
      await book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(10), P(90), USDC(800), await expiryIn(DAY));
      await expect(book.connect(bob).refundExpired(1)).to.be.revertedWithCustomError(book, "NotExpired");
      await time.increase(DAY + 1);
      await expect(book.connect(bob).refundExpired(1)).to.emit(book, "OrderExpired");
      expect(await stock.balanceOf(alice.address)).to.equal(STOCK(1000));
      expect((await book.getOrder(1)).status).to.equal(S.EXPIRED);
    });
  });

  describe("views and admin", () => {
    it("returns order ranges for the keeper", async () => {
      const { book, alice, stock } = await loadFixture(deploy);
      const exp = await expiryIn(DAY);
      for (let i = 0; i < 3; i++) await book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(1), P(90), 1, exp);
      const [ids, list] = await book.getOrdersRange(1, 100);
      expect(ids.map(Number)).to.deep.equal([1, 2, 3]);
      expect(list.length).to.equal(3);
      const [emptyIds] = await book.getOrdersRange(10, 20);
      expect(emptyIds.length).to.equal(0);
    });

    it("exposes the normalized current price", async () => {
      const { book, stock } = await loadFixture(deploy);
      const [price] = await book.currentPrice(stock.target);
      expect(price).to.equal(P(100));
    });

    it("restricts admin functions and caps the keeper fee", async () => {
      const { book, alice, owner } = await loadFixture(deploy);
      await expect(book.connect(alice).setKeeperFeeBps(5)).to.be.revertedWithCustomError(book, "OwnableUnauthorizedAccount");
      await expect(book.connect(alice).pause()).to.be.revertedWithCustomError(book, "OwnableUnauthorizedAccount");
      await expect(book.connect(owner).setKeeperFeeBps(101)).to.be.revertedWithCustomError(book, "FeeTooHigh");
      await book.connect(owner).setKeeperFeeBps(0);
      expect(await book.keeperFeeBps()).to.equal(0);
    });

    it("disabling a market blocks new orders and execution but not cancellation", async () => {
      const { book, alice, keeper, owner, stock, feed, adapter, setPrice } = await loadFixture(deploy);
      await book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(10), P(90), USDC(800), await expiryIn(DAY));
      await book.connect(owner).setMarket(stock.target, feed.target, 3600, adapter.target, STOCK(1000), USDC(100000), 500, false);
      await setPrice(85);
      await expect(book.connect(keeper).executeOrder(1)).to.be.revertedWithCustomError(book, "MarketDisabled");
      await book.connect(alice).cancelOrder(1);
    });
  });

  describe("UniswapV3Adapter integration (mock router)", () => {
    async function adapterFixture() {
      const base = await deploy();
      const { owner, stock, usdc, feed } = base;
      const router = await (await ethers.getContractFactory("MockRouter02")).deploy();
      const book2 = await (await ethers.getContractFactory("LimitOrderBook")).deploy(usdc.target, owner.address, 10);
      const adapter = await (await ethers.getContractFactory("UniswapV3Adapter")).deploy(book2.target, router.target, owner.address);
      await book2.setMarket(stock.target, feed.target, 3600, adapter.target, STOCK(1000), USDC(100000), 500, true);
      await usdc.mint(router.target, USDC(1_000_000));
      await stock.mint(router.target, STOCK(1_000_000));
      for (const u of [base.alice]) {
        await stock.connect(u).approve(book2.target, ethers.MaxUint256);
        await usdc.connect(u).approve(book2.target, ethers.MaxUint256);
      }
      return { ...base, router, book2, v3: adapter };
    }

    it("swaps through the router and delivers output to the order book", async () => {
      const { book2, v3, router, alice, keeper, stock, usdc, feed } = await loadFixture(adapterFixture);
      await v3.setPoolFee(stock.target, usdc.target, 3000);
      await book2.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(10), P(90), USDC(800), await expiryIn(DAY));
      await feed.setAnswer(P(85));
      await router.setRate(P(85), 10n ** 20n);
      const before = await usdc.balanceOf(alice.address);
      await book2.connect(keeper).executeOrder(1);
      const gross = USDC(850);
      expect(await usdc.balanceOf(alice.address) - before).to.equal(gross - (gross * 10n) / 10000n);
      // no tokens or allowances left behind
      expect(await stock.balanceOf(v3.target)).to.equal(0);
      expect(await stock.allowance(book2.target, v3.target)).to.equal(0);
      expect(await stock.allowance(v3.target, router.target)).to.equal(0);
    });

    it("reverts without a configured pool fee and rejects direct calls", async () => {
      const { book2, v3, alice, keeper, stock, usdc, feed } = await loadFixture(adapterFixture);
      await book2.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(10), P(90), USDC(800), await expiryIn(DAY));
      await feed.setAnswer(P(85));
      await expect(book2.connect(keeper).executeOrder(1)).to.be.revertedWithCustomError(v3, "NoPool");
      await expect(v3.connect(keeper).swap(stock.target, usdc.target, 1, 0)).to.be.revertedWithCustomError(v3, "OnlyOrderBook");
    });
  });
});

describe("deployAll script", () => {
  it("deploys and wires a market end to end", async () => {
    const { deployAll } = require("../scripts/deployLib");
    const { stock, usdc, feed, alice, keeper } = await loadFixture(deploy);
    const router = await (await ethers.getContractFactory("MockRouter02")).deploy();
    const { book, adapter } = await deployAll({
      quoteToken: usdc.target, router: router.target, stockToken: stock.target, feed: feed.target,
      poolFee: 500, maxStaleness: 3600, maxStockIn: STOCK(10), maxQuoteIn: USDC(500), keeperFeeBps: 10,
    });
    const m = await book.markets(stock.target);
    expect(m.enabled).to.equal(true);
    expect(m.adapter).to.equal(adapter.target);
    expect(await adapter.poolFee(
      ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "address"],
        stock.target.toLowerCase() < usdc.target.toLowerCase() ? [stock.target, usdc.target] : [usdc.target, stock.target])))).to.equal(500);
    await stock.connect(alice).approve(book.target, ethers.MaxUint256);
    await expect(book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(11), P(90), 1, await expiryIn(DAY)))
      .to.be.revertedWithCustomError(book, "AmountTooLarge");
  });
});

// =====================================================================
// v2 features
// =====================================================================
describe("v2: oracle-bounded fill guard", () => {
  it("rejects market config with a 0 or >50% deviation bound", async () => {
    const { book, owner, stock, feed, adapter } = await loadFixture(deploy);
    await expect(book.connect(owner).setMarket(stock.target, feed.target, 3600, adapter.target, 1, 1, 0, true))
      .to.be.revertedWithCustomError(book, "InvalidParams");
    await expect(book.connect(owner).setMarket(stock.target, feed.target, 3600, adapter.target, 1, 1, 5001, true))
      .to.be.revertedWithCustomError(book, "InvalidParams");
  });

  it("sell: reverts when the pool pays far below the oracle even if above the user's own minimum", async () => {
    const { book, alice, keeper, stock, usdc, adapter, setPrice } = await loadFixture(deploy);
    await book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(10), P(90), USDC(700), await expiryIn(DAY));
    await setPrice(85); // oracle $85 => ideal 850 USDC, floor (5%) 807.5
    await adapter.setRate(stock.target, usdc.target, P(75), 10n ** 20n); // pool pays only $75
    await expect(book.connect(keeper).executeOrder(1)).to.be.revertedWithCustomError(book, "FillBelowOracleBound");
    expect((await book.getOrder(1)).status).to.equal(S.OPEN);
    await adapter.setRate(stock.target, usdc.target, P(84), 10n ** 20n); // within bound
    await book.connect(keeper).executeOrder(1);
    expect((await book.getOrder(1)).status).to.equal(S.EXECUTED);
  });

  it("buy: reverts when the pool gives far less stock than the oracle implies", async () => {
    const { book, alice, keeper, stock, usdc, adapter, setPrice } = await loadFixture(deploy);
    await book.connect(alice).createOrder(stock.target, T.LIMIT_BUY, USDC(900), P(90), STOCK(8), await expiryIn(DAY));
    await setPrice(89);
    await adapter.setRate(usdc.target, stock.target, 10n ** 20n, P(100)); // pool prices stock at $100 => 9 stock
    await expect(book.connect(keeper).executeOrder(1)).to.be.revertedWithCustomError(book, "FillBelowOracleBound");
  });
});

describe("v2: trailing stop", () => {
  it("creates with stop = peak * (1 - trail) and stores the peak", async () => {
    const { book, alice, stock } = await loadFixture(deploy);
    await expect(book.connect(alice).createTrailingStop(stock.target, STOCK(10), 1000, USDC(800), await expiryIn(DAY)))
      .to.emit(book, "OrderCreated");
    const o = await book.getOrder(1);
    expect(o.orderType).to.equal(3);
    expect(o.trailBps).to.equal(1000);
    expect(o.peakPrice).to.equal(P(100));
    expect(o.triggerPrice).to.equal(P(90));
    expect(await stock.balanceOf(book.target)).to.equal(STOCK(10));
  });

  it("ratchets up on new highs, never down, and executes below the raised stop", async () => {
    const { book, alice, keeper, stock, usdc, setPrice } = await loadFixture(deploy);
    await book.connect(alice).createTrailingStop(stock.target, STOCK(10), 1000, USDC(800), await expiryIn(DAY));

    await setPrice(120);
    expect(await book.canUpdateTrailing(1)).to.equal(true);
    await expect(book.connect(keeper).updateTrailing(1)).to.emit(book, "TrailUpdated").withArgs(1, P(120), P(108));
    let o = await book.getOrder(1);
    expect(o.peakPrice).to.equal(P(120));
    expect(o.triggerPrice).to.equal(P(108));

    await setPrice(115); // below peak: no update, stop unchanged, not triggered
    expect(await book.canUpdateTrailing(1)).to.equal(false);
    await expect(book.connect(keeper).updateTrailing(1)).to.be.revertedWithCustomError(book, "NoTrailUpdate");
    expect(await book.canExecute(1)).to.equal(false);
    expect((await book.getOrder(1)).triggerPrice).to.equal(P(108));

    await setPrice(107); // below the raised stop => executes
    expect(await book.canExecute(1)).to.equal(true);
    const before = await usdc.balanceOf(alice.address);
    await book.connect(keeper).executeOrder(1);
    const gross = USDC(1070);
    expect(await usdc.balanceOf(alice.address) - before).to.equal(gross - (gross * 10n) / 10000n);
  });

  it("without a ratchet it behaves like a normal stop at the initial level", async () => {
    const { book, alice, keeper, stock, setPrice } = await loadFixture(deploy);
    await book.connect(alice).createTrailingStop(stock.target, STOCK(10), 1000, USDC(800), await expiryIn(DAY));
    await setPrice(95);
    await expect(book.connect(keeper).executeOrder(1)).to.be.revertedWithCustomError(book, "NotTriggered");
    await setPrice(89);
    await book.connect(keeper).executeOrder(1);
    expect((await book.getOrder(1)).status).to.equal(S.EXECUTED);
  });

  it("validates trail size, order type and feed freshness", async () => {
    const { book, alice, keeper, stock, setPrice } = await loadFixture(deploy);
    const exp = await expiryIn(DAY);
    await expect(book.connect(alice).createTrailingStop(stock.target, STOCK(1), 49, 1, exp)).to.be.revertedWithCustomError(book, "InvalidParams");
    await expect(book.connect(alice).createTrailingStop(stock.target, STOCK(1), 5001, 1, exp)).to.be.revertedWithCustomError(book, "InvalidParams");
    await expect(book.connect(alice).createOrder(stock.target, 3, STOCK(1), P(90), 1, exp)).to.be.revertedWithCustomError(book, "InvalidParams");
    await book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(1), P(90), 1, exp); // id 1, not trailing
    await expect(book.connect(keeper).updateTrailing(1)).to.be.revertedWithCustomError(book, "NotTrailing");
    await book.connect(alice).createTrailingStop(stock.target, STOCK(1), 500, 1, exp); // id 2
    await setPrice(120);
    await time.increase(3601); // feed goes stale
    await expect(book.connect(keeper).updateTrailing(2)).to.be.revertedWithCustomError(book, "StalePrice");
  });
});

describe("v2: bracket (take-profit + stop-loss, one cancels other)", () => {
  async function bracket(f, tp = 110, sl = 90) {
    const exp = await expiryIn(DAY);
    await f.book.connect(f.alice).createBracket(f.stock.target, STOCK(10), P(tp), P(sl), USDC(1000), USDC(800), exp);
    return exp;
  }

  it("escrows ONCE and creates two linked legs", async () => {
    const f = await loadFixture(deploy);
    await expect(f.book.connect(f.alice).createBracket(f.stock.target, STOCK(10), P(110), P(90), USDC(1000), USDC(800), await expiryIn(DAY)))
      .to.emit(f.book, "BracketCreated").withArgs(1, 2);
    expect(await f.stock.balanceOf(f.book.target)).to.equal(STOCK(10));
    const tp = await f.book.getOrder(1), sl = await f.book.getOrder(2);
    expect(tp.orderType).to.equal(T.LIMIT_SELL);
    expect(sl.orderType).to.equal(T.STOP_LOSS);
    expect(tp.linkedId).to.equal(2);
    expect(sl.linkedId).to.equal(1);
    expect(await f.book.ordersOf(f.alice.address)).to.deep.equal([1n, 2n]);
  });

  it("take-profit fill cancels the stop-loss and spends the deposit once", async () => {
    const f = await loadFixture(deploy);
    await bracket(f);
    await f.setPrice(111);
    await f.book.connect(f.keeper).executeOrder(1);
    expect((await f.book.getOrder(1)).status).to.equal(S.EXECUTED);
    expect((await f.book.getOrder(2)).status).to.equal(S.CANCELLED);
    expect(await f.stock.balanceOf(f.book.target)).to.equal(0);
    await expect(f.book.connect(f.keeper).executeOrder(2)).to.be.revertedWithCustomError(f.book, "NotOpen");
    await expect(f.book.connect(f.alice).cancelOrder(2)).to.be.revertedWithCustomError(f.book, "NotOpen");
  });

  it("stop-loss fill cancels the take-profit", async () => {
    const f = await loadFixture(deploy);
    await bracket(f);
    await f.setPrice(85);
    await f.book.connect(f.keeper).executeOrder(2);
    expect((await f.book.getOrder(2)).status).to.equal(S.EXECUTED);
    expect((await f.book.getOrder(1)).status).to.equal(S.CANCELLED);
    expect(await f.stock.balanceOf(f.book.target)).to.equal(0);
  });

  it("cancelling either leg closes both and refunds the deposit once", async () => {
    const f = await loadFixture(deploy);
    await bracket(f);
    await f.book.connect(f.alice).cancelOrder(2);
    expect((await f.book.getOrder(1)).status).to.equal(S.CANCELLED);
    expect((await f.book.getOrder(2)).status).to.equal(S.CANCELLED);
    expect(await f.stock.balanceOf(f.alice.address)).to.equal(STOCK(1000));
    expect(await f.stock.balanceOf(f.book.target)).to.equal(0);
  });

  it("expiry refunds the deposit once for both legs", async () => {
    const f = await loadFixture(deploy);
    await bracket(f);
    await time.increase(DAY + 1);
    await f.book.connect(f.bob).refundExpired(1);
    expect((await f.book.getOrder(1)).status).to.equal(S.EXPIRED);
    expect((await f.book.getOrder(2)).status).to.equal(S.EXPIRED);
    expect(await f.stock.balanceOf(f.alice.address)).to.equal(STOCK(1000));
    expect(await f.stock.balanceOf(f.book.target)).to.equal(0);
  });

  it("validates the bracket", async () => {
    const { book, alice, stock } = await loadFixture(deploy);
    const exp = await expiryIn(DAY);
    const mk = (tp, sl, m1 = USDC(1000), m2 = USDC(800)) =>
      book.connect(alice).createBracket(stock.target, STOCK(10), tp, sl, m1, m2, exp);
    await expect(mk(P(90), P(90))).to.be.revertedWithCustomError(book, "InvalidBracket");
    await expect(mk(P(90), P(110))).to.be.revertedWithCustomError(book, "InvalidBracket");
    await expect(mk(P(95), P(90))).to.be.revertedWithCustomError(book, "AlreadyTriggered"); // price 100 >= TP
    await expect(mk(P(120), P(105))).to.be.revertedWithCustomError(book, "AlreadyTriggered"); // price 100 <= SL
    await expect(mk(P(110), 0)).to.be.revertedWithCustomError(book, "InvalidParams");
    await expect(mk(P(110), P(90), USDC(1000), 0)).to.be.revertedWithCustomError(book, "InvalidParams");
  });
});

describe("v2: edit orders in place", () => {
  it("lets the owner change trigger and minimum, then executes at the new trigger", async () => {
    const f = await loadFixture(deploy);
    await f.book.connect(f.alice).createOrder(f.stock.target, T.LIMIT_SELL, STOCK(10), P(110), USDC(1000), await expiryIn(DAY));
    await expect(f.book.connect(f.alice).updateOrder(1, P(120), USDC(1100))).to.emit(f.book, "OrderUpdated").withArgs(1, P(120), USDC(1100));
    const o = await f.book.getOrder(1);
    expect(o.triggerPrice).to.equal(P(120));
    expect(o.minAmountOut).to.equal(USDC(1100));
    await f.setPrice(115);
    await expect(f.book.connect(f.keeper).executeOrder(1)).to.be.revertedWithCustomError(f.book, "NotTriggered");
    await f.setPrice(121);
    await f.book.connect(f.keeper).executeOrder(1);
    expect((await f.book.getOrder(1)).status).to.equal(S.EXECUTED);
  });

  it("edits a bracket leg without breaking the link", async () => {
    const f = await loadFixture(deploy);
    await f.book.connect(f.alice).createBracket(f.stock.target, STOCK(10), P(110), P(90), USDC(1000), USDC(800), await expiryIn(DAY));
    await f.book.connect(f.alice).updateOrder(2, P(95), USDC(850));
    expect((await f.book.getOrder(2)).triggerPrice).to.equal(P(95));
    expect((await f.book.getOrder(2)).linkedId).to.equal(1);
  });

  it("rejects bad edits", async () => {
    const f = await loadFixture(deploy);
    const { book, alice, bob, stock } = f;
    const exp = await expiryIn(DAY);
    await book.connect(alice).createOrder(stock.target, T.LIMIT_SELL, STOCK(10), P(110), USDC(1000), exp); // 1
    await book.connect(alice).createTrailingStop(stock.target, STOCK(10), 1000, USDC(800), exp); // 2
    await expect(book.connect(bob).updateOrder(1, P(120), USDC(1))).to.be.revertedWithCustomError(book, "NotOwner");
    await expect(book.connect(alice).updateOrder(1, P(95), USDC(1))).to.be.revertedWithCustomError(book, "AlreadyTriggered");
    await expect(book.connect(alice).updateOrder(1, 0, USDC(1))).to.be.revertedWithCustomError(book, "InvalidParams");
    await expect(book.connect(alice).updateOrder(1, P(120), 0)).to.be.revertedWithCustomError(book, "InvalidParams");
    await expect(book.connect(alice).updateOrder(2, P(95), USDC(1))).to.be.revertedWithCustomError(book, "InvalidParams");
    await time.increase(DAY + 1);
    await expect(book.connect(alice).updateOrder(1, P(120), USDC(1))).to.be.revertedWithCustomError(book, "OrderHasExpired");
  });
});

describe("v2: recurring buys (DCA)", () => {
  const H = 3601;

  it("creates a plan and escrows the full budget", async () => {
    const { book, alice, stock, usdc } = await loadFixture(deploy);
    await expect(book.connect(alice).createDca(stock.target, USDC(100), 5, 3600, 0)).to.emit(book, "DcaCreated");
    expect(await usdc.balanceOf(book.target)).to.equal(USDC(500));
    const p = await book.getPlan(1);
    expect(p.remaining).to.equal(5);
    expect(p.status).to.equal(S.OPEN);
    expect(await book.plansOf(alice.address)).to.deep.equal([1n]);
  });

  it("buys on schedule, pays the keeper fee, and completes", async () => {
    const { book, alice, keeper, stock, usdc, feed } = await loadFixture(deploy);
    await book.connect(alice).createDca(stock.target, USDC(100), 5, 3600, 0);
    const startStock = await stock.balanceOf(alice.address);

    await book.connect(keeper).executeDca(1); // first buy is immediate: 100 USDC @ $100 = 1 stock
    expect(await book.canExecuteDca(1)).to.equal(false);
    await expect(book.connect(keeper).executeDca(1)).to.be.revertedWithCustomError(book, "TooEarly");
    expect((await book.getPlan(1)).remaining).to.equal(4);

    for (let i = 0; i < 4; i++) {
      await time.increase(H);
      await feed.setAnswer(P(100)); // keep the feed fresh
      expect(await book.canExecuteDca(1)).to.equal(true);
      await book.connect(keeper).executeDca(1);
    }
    const p = await book.getPlan(1);
    expect(p.remaining).to.equal(0);
    expect(p.status).to.equal(S.EXECUTED);
    const gross = STOCK(1), fee = (gross * 10n) / 10000n;
    expect(await stock.balanceOf(alice.address) - startStock).to.equal(5n * (gross - fee));
    expect(await stock.balanceOf(keeper.address)).to.equal(5n * fee);
    expect(await usdc.balanceOf(book.target)).to.equal(0);
    await expect(book.connect(keeper).executeDca(1)).to.be.revertedWithCustomError(book, "NotOpen");
  });

  it("honours the price ceiling", async () => {
    const { book, alice, keeper, stock, setPrice } = await loadFixture(deploy);
    await book.connect(alice).createDca(stock.target, USDC(100), 3, 3600, P(90));
    expect(await book.canExecuteDca(1)).to.equal(false);
    await expect(book.connect(keeper).executeDca(1)).to.be.revertedWithCustomError(book, "PriceAboveCeiling");
    await setPrice(85);
    expect(await book.canExecuteDca(1)).to.equal(true);
    await book.connect(keeper).executeDca(1);
    expect((await book.getPlan(1)).remaining).to.equal(2);
  });

  it("cancel refunds only the unspent budget; only the owner; works while paused", async () => {
    const { book, alice, bob, keeper, owner, stock, usdc } = await loadFixture(deploy);
    await book.connect(alice).createDca(stock.target, USDC(100), 5, 3600, 0);
    await book.connect(keeper).executeDca(1);
    await expect(book.connect(bob).cancelDca(1)).to.be.revertedWithCustomError(book, "NotOwner");
    await book.connect(owner).pause();
    const before = await usdc.balanceOf(alice.address);
    await expect(book.connect(alice).cancelDca(1)).to.emit(book, "DcaCancelled").withArgs(1, alice.address, USDC(400));
    expect(await usdc.balanceOf(alice.address) - before).to.equal(USDC(400));
    expect((await book.getPlan(1)).status).to.equal(S.CANCELLED);
    await expect(book.connect(alice).cancelDca(1)).to.be.revertedWithCustomError(book, "NotOpen");
  });

  it("is protected by the oracle fill guard and the stale-feed check", async () => {
    const { book, alice, keeper, stock, usdc, adapter } = await loadFixture(deploy);
    await book.connect(alice).createDca(stock.target, USDC(100), 5, 3600, 0);
    await adapter.setRate(usdc.target, stock.target, 10n ** 20n, P(130)); // pool pays ~23% less stock than the oracle implies
    // For DCA the oracle floor is passed to the swap as its minimum, so the pool itself reverts ("Too little received");
    // the contract's own FillBelowOracleBound check is a second layer for adapters that ignore the minimum.
    await expect(book.connect(keeper).executeDca(1)).to.be.reverted;
    expect((await book.getPlan(1)).remaining).to.equal(5); // the revert rolled everything back
    await time.increase(H); // feed now stale
    await expect(book.connect(keeper).executeDca(1)).to.be.revertedWithCustomError(book, "StalePrice");
  });

  it("validates parameters, caps, market and pause", async () => {
    const { book, alice, keeper, owner, stock, usdc } = await loadFixture(deploy);
    const mk = (a, b, i) => book.connect(alice).createDca(stock.target, a, b, i, 0);
    await expect(mk(0, 5, 3600)).to.be.revertedWithCustomError(book, "InvalidParams");
    await expect(mk(USDC(1), 0, 3600)).to.be.revertedWithCustomError(book, "InvalidParams");
    await expect(mk(USDC(1), 366, 3600)).to.be.revertedWithCustomError(book, "InvalidParams");
    await expect(mk(USDC(1), 5, 3599)).to.be.revertedWithCustomError(book, "InvalidParams");
    await expect(mk(USDC(30000), 4, 3600)).to.be.revertedWithCustomError(book, "AmountTooLarge");
    await expect(book.connect(alice).createDca(usdc.target, USDC(1), 5, 3600, 0)).to.be.revertedWithCustomError(book, "MarketDisabled");
    await book.connect(alice).createDca(stock.target, USDC(100), 5, 3600, 0);
    await book.connect(owner).pause();
    await expect(mk(USDC(1), 5, 3600)).to.be.revertedWithCustomError(book, "EnforcedPause");
    await expect(book.connect(keeper).executeDca(1)).to.be.revertedWithCustomError(book, "EnforcedPause");
    expect(await book.canExecuteDca(1)).to.equal(false);
  });

  it("returns plan ranges for the keeper", async () => {
    const { book, alice, stock } = await loadFixture(deploy);
    for (let i = 0; i < 2; i++) await book.connect(alice).createDca(stock.target, USDC(10), 2, 3600, 0);
    const [ids, list] = await book.getPlansRange(1, 50);
    expect(ids.map(Number)).to.deep.equal([1, 2]);
    expect(list.length).to.equal(2);
  });

  it("the order book's own check also catches an adapter that ignores the minimum (defense in depth)", async () => {
    const { book, owner, alice, keeper, stock, usdc, feed } = await loadFixture(deploy);
    const loose = await (await ethers.getContractFactory("MockLooseAdapter")).deploy();
    await stock.mint(loose.target, STOCK(1_000_000));
    await book.connect(owner).setMarket(stock.target, feed.target, 3600, loose.target, STOCK(1000), USDC(100000), 500, true);
    await loose.setRate(10n ** 20n, P(130)); // pays ~23% too little stock
    await book.connect(alice).createDca(stock.target, USDC(100), 5, 3600, 0);
    await expect(book.connect(keeper).executeDca(1)).to.be.revertedWithCustomError(book, "FillBelowOracleBound");
  });
});
