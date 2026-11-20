const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const P = (usd) => BigInt(Math.round(usd * 1e8));
const STOCK = (n) => ethers.parseUnits(String(n), 18);
const USDC = (n) => ethers.parseUnits(String(n), 6);
const T = { LIMIT_BUY: 0, LIMIT_SELL: 1, STOP_LOSS: 2 };
const S = { NONE: 0, OPEN: 1, EXECUTED: 2, CANCELLED: 3, EXPIRED: 4 };
const DAY = 86400;

async function deploy() {
  const [owner, alice, bob, keeper, guardian] = await ethers.getSigners();
  const ERC = await ethers.getContractFactory("MockERC20");
  const stock = await ERC.deploy("NVDA onchain", "NVDAc", 18);
  const usdc = await ERC.deploy("USD Coin", "USDC", 6);
  const feed = await (await ethers.getContractFactory("MockFeed")).deploy(P(100));
  const adapter = await (await ethers.getContractFactory("MockAdapter")).deploy();
  const book = await (await ethers.getContractFactory("LimitOrderBook")).deploy(usdc.target, owner.address, 10);
  await book.setMarket(stock.target, feed.target, 3600, adapter.target, STOCK(1000), USDC(100000), 500, true);
  await book.setKeeper(keeper.address, true);
  await stock.mint(adapter.target, STOCK(1_000_000));
  await usdc.mint(adapter.target, USDC(1_000_000_000));
  for (const u of [alice, bob]) {
    await stock.mint(u.address, STOCK(1000));
    await usdc.mint(u.address, USDC(100000));
    await stock.connect(u).approve(book.target, ethers.MaxUint256);
    await usdc.connect(u).approve(book.target, ethers.MaxUint256);
  }
  const setPrice = async (usd) => {
    await feed.setAnswer(P(usd));
    await adapter.setRate(usdc.target, stock.target, 10n ** 20n, P(usd));
    await adapter.setRate(stock.target, usdc.target, P(usd), 10n ** 20n);
  };
  await setPrice(100);
  return { owner, alice, bob, keeper, guardian, stock, usdc, feed, adapter, book, setPrice };
}

const expiryIn = async (s) => BigInt((await time.latest()) + s);

describe("v2.1: recurring sells", () => {
  const H = 3601;

  it("creates a sell plan and escrows the stock", async () => {
    const { book, alice, stock } = await loadFixture(deploy);
    await expect(book.connect(alice).createDcaSell(stock.target, STOCK(2), 5, 3600, 0)).to.emit(book, "DcaSellCreated");
    expect(await stock.balanceOf(book.target)).to.equal(STOCK(10));
    expect(await book.isSellPlan(1)).to.equal(true);
    expect((await book.getPlan(1)).remaining).to.equal(5);
    expect(await book.stockEscrowed(stock.target)).to.equal(STOCK(10));
  });

  it("sells on schedule, pays the keeper fee in quote, and completes", async () => {
    const { book, alice, keeper, stock, usdc, feed } = await loadFixture(deploy);
    await book.connect(alice).createDcaSell(stock.target, STOCK(2), 3, 3600, 0);
    const start = await usdc.balanceOf(alice.address);

    await book.connect(keeper).executeDca(1); // 2 stock @ $100 = 200 USDC gross
    await expect(book.connect(keeper).executeDca(1)).to.be.revertedWithCustomError(book, "TooEarly");
    for (let i = 0; i < 2; i++) {
      await time.increase(H);
      await feed.setAnswer(P(100));
      await book.connect(keeper).executeDca(1);
    }
    const p = await book.getPlan(1);
    expect(p.remaining).to.equal(0);
    expect(p.status).to.equal(S.EXECUTED);
    const gross = USDC(200), fee = (gross * 10n) / 10000n;
    expect((await usdc.balanceOf(alice.address)) - start).to.equal(3n * (gross - fee));
    expect(await usdc.balanceOf(keeper.address)).to.equal(3n * fee);
    expect(await stock.balanceOf(book.target)).to.equal(0);
    expect(await book.stockEscrowed(stock.target)).to.equal(0);
  });

  it("honours the price floor", async () => {
    const { book, alice, keeper, stock, setPrice } = await loadFixture(deploy);
    await book.connect(alice).createDcaSell(stock.target, STOCK(1), 3, 3600, P(110));
    expect(await book.canExecuteDca(1)).to.equal(false);
    await expect(book.connect(keeper).executeDca(1)).to.be.revertedWithCustomError(book, "PriceBelowFloor");
    await setPrice(115);
    expect(await book.canExecuteDca(1)).to.equal(true);
    await book.connect(keeper).executeDca(1);
    expect((await book.getPlan(1)).remaining).to.equal(2);
  });

  it("cancel refunds only the unsold stock, only to the owner, even while paused", async () => {
    const { book, alice, bob, keeper, owner, stock } = await loadFixture(deploy);
    await book.connect(alice).createDcaSell(stock.target, STOCK(2), 5, 3600, 0);
    await book.connect(keeper).executeDca(1);
    await expect(book.connect(bob).cancelDca(1)).to.be.revertedWithCustomError(book, "NotOwner");
    await book.connect(owner).pause();
    const before = await stock.balanceOf(alice.address);
    await expect(book.connect(alice).cancelDca(1)).to.emit(book, "DcaCancelled").withArgs(1, alice.address, STOCK(8));
    expect((await stock.balanceOf(alice.address)) - before).to.equal(STOCK(8));
    expect(await stock.balanceOf(book.target)).to.equal(0);
    expect(await book.stockEscrowed(stock.target)).to.equal(0);
  });

  it("validates params, per-market cap and pause", async () => {
    const { book, alice, owner, stock } = await loadFixture(deploy);
    await expect(book.connect(alice).createDcaSell(stock.target, 0, 3, 3600, 0)).to.be.revertedWithCustomError(book, "InvalidParams");
    await expect(book.connect(alice).createDcaSell(stock.target, STOCK(1), 0, 3600, 0)).to.be.revertedWithCustomError(book, "InvalidParams");
    await expect(book.connect(alice).createDcaSell(stock.target, STOCK(1), 3, 60, 0)).to.be.revertedWithCustomError(book, "InvalidParams");
    await expect(book.connect(alice).createDcaSell(stock.target, STOCK(400), 3, 3600, 0)).to.be.revertedWithCustomError(book, "AmountTooLarge");
    await book.connect(owner).pause();
    await expect(book.connect(alice).createDcaSell(stock.target, STOCK(1), 3, 3600, 0)).to.be.revertedWithCustomError(book, "EnforcedPause");
  });

  it("does not disturb buy plans (shared executeDca)", async () => {
    const { book, alice, keeper, stock, usdc } = await loadFixture(deploy);
    await book.connect(alice).createDca(stock.target, USDC(100), 2, 3600, 0);
    expect(await book.isSellPlan(1)).to.equal(false);
    await book.connect(keeper).executeDca(1);
    expect(await book.quoteEscrowed(stock.target)).to.equal(USDC(100));
    expect(await usdc.balanceOf(book.target)).to.equal(USDC(100));
  });
});

describe("v2.1: escrow ceilings", () => {
  it("is unlimited until the owner sets a ceiling, and only the owner can set it", async () => {
    const { book, alice, stock } = await loadFixture(deploy);
    await expect(book.connect(alice).setEscrowCaps(stock.target, 1, 1)).to.be.revertedWithCustomError(book, "OwnableUnauthorizedAccount");
    const exp = await expiryIn(DAY);
    await book.connect(alice).createOrder(stock.target, T.LIMIT_BUY, USDC(900), P(90), STOCK(9), exp);
    expect(await book.quoteEscrowed(stock.target)).to.equal(USDC(900));
  });

  it("blocks new deposits above the ceiling and frees room on cancel", async () => {
    const { book, owner, alice, bob, stock } = await loadFixture(deploy);
    await book.connect(owner).setEscrowCaps(stock.target, STOCK(10), USDC(1000));
    const exp = await expiryIn(DAY);
    await book.connect(alice).createOrder(stock.target, T.LIMIT_BUY, USDC(600), P(90), STOCK(5), exp);
    await expect(book.connect(bob).createOrder(stock.target, T.LIMIT_BUY, USDC(500), P(90), STOCK(5), exp)).to.be.revertedWithCustomError(book, "EscrowCapReached");
    await expect(book.connect(bob).createDca(stock.target, USDC(250), 2, 3600, 0)).to.be.revertedWithCustomError(book, "EscrowCapReached");
    await book.connect(alice).cancelOrder(1);
    expect(await book.quoteEscrowed(stock.target)).to.equal(0);
    await book.connect(bob).createOrder(stock.target, T.LIMIT_BUY, USDC(500), P(90), STOCK(5), exp);

    await book.connect(alice).createOrder(stock.target, T.LIMIT_SELL, STOCK(6), P(110), USDC(500), exp);
    await expect(book.connect(bob).createDcaSell(stock.target, STOCK(5), 1, 3600, 0)).to.be.revertedWithCustomError(book, "EscrowCapReached");
  });

  it("counts a bracket deposit once and releases it once (fill and cancel)", async () => {
    const { book, owner, alice, keeper, stock, setPrice } = await loadFixture(deploy);
    await book.connect(owner).setEscrowCaps(stock.target, STOCK(100), 0);
    const exp = await expiryIn(DAY);
    await book.connect(alice).createBracket(stock.target, STOCK(10), P(110), P(90), USDC(1000), USDC(800), exp);
    expect(await book.stockEscrowed(stock.target)).to.equal(STOCK(10));
    await setPrice(111);
    await book.connect(keeper).executeOrder(1);
    expect(await book.stockEscrowed(stock.target)).to.equal(0);

    await setPrice(100);
    await book.connect(alice).createBracket(stock.target, STOCK(10), P(110), P(90), USDC(1000), USDC(800), await expiryIn(DAY));
    expect(await book.stockEscrowed(stock.target)).to.equal(STOCK(10));
    await book.connect(alice).cancelOrder(3);
    expect(await book.stockEscrowed(stock.target)).to.equal(0);
  });

  it("releases on expiry refunds and trailing stops", async () => {
    const { book, owner, alice, stock } = await loadFixture(deploy);
    await book.connect(owner).setEscrowCaps(stock.target, STOCK(100), USDC(1000));
    await book.connect(alice).createTrailingStop(stock.target, STOCK(5), 500, USDC(400), await expiryIn(DAY));
    expect(await book.stockEscrowed(stock.target)).to.equal(STOCK(5));
    await time.increase(DAY + 10);
    await book.refundExpired(1);
    expect(await book.stockEscrowed(stock.target)).to.equal(0);
  });
});

describe("v2.1: guardian", () => {
  it("can pause but nothing else; only the owner unpauses; exits keep working", async () => {
    const { book, owner, alice, bob, guardian, stock } = await loadFixture(deploy);
    await expect(book.connect(bob).pause()).to.be.revertedWithCustomError(book, "NotGuardian");
    await expect(book.connect(guardian).pause()).to.be.revertedWithCustomError(book, "NotGuardian");
    await expect(book.connect(guardian).setGuardian(guardian.address)).to.be.revertedWithCustomError(book, "OwnableUnauthorizedAccount");

    await expect(book.connect(owner).setGuardian(guardian.address)).to.emit(book, "GuardianSet").withArgs(guardian.address);
    const exp = await expiryIn(DAY);
    await book.connect(alice).createOrder(stock.target, T.LIMIT_BUY, USDC(900), P(90), STOCK(9), exp);

    await book.connect(guardian).pause();
    expect(await book.paused()).to.equal(true);
    await expect(book.connect(guardian).unpause()).to.be.revertedWithCustomError(book, "OwnableUnauthorizedAccount");
    await expect(book.connect(guardian).setEscrowCaps(stock.target, 1, 1)).to.be.revertedWithCustomError(book, "OwnableUnauthorizedAccount");
    await book.connect(alice).cancelOrder(1); // exit still works while paused
    await book.connect(owner).unpause();
    expect(await book.paused()).to.equal(false);
  });

  it("owner can still pause, and the guardian can be revoked", async () => {
    const { book, owner, guardian } = await loadFixture(deploy);
    await book.connect(owner).setGuardian(guardian.address);
    await book.connect(owner).setGuardian(ethers.ZeroAddress);
    await expect(book.connect(guardian).pause()).to.be.revertedWithCustomError(book, "NotGuardian");
    await book.connect(owner).pause();
    expect(await book.paused()).to.equal(true);
  });
});

describe("v2.1: deployAll ownership handoff", () => {
  it("wires markets as the deployer, then offers ownership to the Safe (2-step)", async () => {
    const { deployAll } = require("../scripts/deployLib");
    const { stock, usdc, feed, bob, guardian } = await loadFixture(deploy);
    const router = await (await ethers.getContractFactory("MockRouter02")).deploy();
    const safe = bob; // stand-in for the multisig
    const { book, adapter, pendingOwner } = await deployAll({
      quoteToken: usdc.target,
      router: router.target,
      owner: safe.address,
      guardian: guardian.address,
      markets: [
        {
          stockToken: stock.target, feed: feed.target, poolFee: 500, maxStaleness: 3600,
          maxStockIn: STOCK(10).toString(), maxQuoteIn: USDC(500).toString(),
          maxStockEscrow: STOCK(50).toString(), maxQuoteEscrow: USDC(2000).toString(), maxDeviationBps: 300,
        },
      ],
    });
    expect(pendingOwner).to.equal(safe.address);
    expect((await book.markets(stock.target)).enabled).to.equal(true);
    expect(await book.maxStockEscrow(stock.target)).to.equal(STOCK(50));
    expect(await book.maxQuoteEscrow(stock.target)).to.equal(USDC(2000));
    expect(await book.guardian()).to.equal(guardian.address);
    expect(await book.pendingOwner()).to.equal(safe.address);
    expect(await adapter.pendingOwner()).to.equal(safe.address);

    await book.connect(safe).acceptOwnership();
    await adapter.connect(safe).acceptOwnership();
    expect(await book.owner()).to.equal(safe.address);
    expect(await adapter.owner()).to.equal(safe.address);
  });
});

describe("v2.1: limit buy with attached TP/SL", () => {
  const exits = (tp, sl, slip = 200, dur = 7 * DAY) => ({ takeProfitPrice: P(tp), stopLossPrice: P(sl), slippageBps: slip, duration: dur });

  it("validates the exits", async () => {
    const { book, alice, stock } = await loadFixture(deploy);
    const exp = await expiryIn(DAY);
    const mk = (e) => book.connect(alice).createLimitBuyWithExits(stock.target, USDC(900), P(90), STOCK(9), exp, e);
    await expect(mk(exits(90, 80))).to.be.revertedWithCustomError(book, "InvalidBracket"); // tp not above trigger
    await expect(mk(exits(110, 90))).to.be.revertedWithCustomError(book, "InvalidBracket"); // sl not below trigger
    await expect(mk(exits(110, 0))).to.be.revertedWithCustomError(book, "InvalidBracket");
    await expect(mk(exits(110, 80, 10))).to.be.revertedWithCustomError(book, "InvalidParams"); // slippage <= keeper fee
    await expect(mk(exits(110, 80, 200, 60))).to.be.revertedWithCustomError(book, "InvalidExpiry");
    await expect(mk(exits(110, 80))).to.emit(book, "ExitsAttached");
    expect((await book.attachedExits(1)).takeProfitPrice).to.equal(P(110));
  });

  it("fills the buy straight into a TP/SL bracket owned by the buyer", async () => {
    const { book, alice, keeper, stock, usdc, setPrice } = await loadFixture(deploy);
    await book.connect(alice).createLimitBuyWithExits(stock.target, USDC(900), P(90), STOCK(9), await expiryIn(DAY), exits(110, 80));
    const stockBefore = await stock.balanceOf(alice.address);
    await setPrice(90);
    await expect(book.connect(keeper).executeOrder(1)).to.emit(book, "ExitsPlaced");

    const gross = STOCK(10), fee = (gross * 10n) / 10000n, net = gross - fee;
    expect(await stock.balanceOf(alice.address)).to.equal(stockBefore); // tokens went into the bracket, not the wallet
    expect(await stock.balanceOf(keeper.address)).to.equal(fee);
    const tp = await book.getOrder(2), sl = await book.getOrder(3);
    expect(tp.owner).to.equal(alice.address);
    expect(tp.orderType).to.equal(T.LIMIT_SELL);
    expect(sl.orderType).to.equal(T.STOP_LOSS);
    expect(tp.amountIn).to.equal(net);
    expect(tp.linkedId).to.equal(3);
    expect(sl.linkedId).to.equal(2);
    expect(await book.stockEscrowed(stock.target)).to.equal(net);
    expect((await book.attachedExits(1)).takeProfitPrice).to.equal(0);

    await setPrice(111);
    const usdcBefore = await usdc.balanceOf(alice.address);
    await book.connect(keeper).executeOrder(2);
    expect(await usdc.balanceOf(alice.address)).to.be.gt(usdcBefore);
    expect((await book.getOrder(3)).status).to.equal(S.CANCELLED);
    expect(await book.stockEscrowed(stock.target)).to.equal(0);
  });

  it("the buyer can cancel the exits and get the tokens back", async () => {
    const { book, alice, keeper, stock, setPrice } = await loadFixture(deploy);
    await book.connect(alice).createLimitBuyWithExits(stock.target, USDC(900), P(90), STOCK(9), await expiryIn(DAY), exits(110, 80));
    await setPrice(90);
    await book.connect(keeper).executeOrder(1);
    const before = await stock.balanceOf(alice.address);
    await book.connect(alice).cancelOrder(3);
    const net = STOCK(10) - (STOCK(10) * 10n) / 10000n;
    expect((await stock.balanceOf(alice.address)) - before).to.equal(net);
    expect(await book.stockEscrowed(stock.target)).to.equal(0);
  });

  it("delivers the tokens instead when the price already gapped through the stop", async () => {
    const { book, alice, keeper, stock, setPrice } = await loadFixture(deploy);
    await book.connect(alice).createLimitBuyWithExits(stock.target, USDC(900), P(95), STOCK(9), await expiryIn(DAY), exits(110, 94));
    const before = await stock.balanceOf(alice.address);
    await setPrice(93);
    await expect(book.connect(keeper).executeOrder(1)).to.emit(book, "ExitsSkipped").withArgs(1, 1);
    expect(await stock.balanceOf(alice.address)).to.be.gt(before);
    expect(await book.nextOrderId()).to.equal(2); // no legs created
  });

  it("delivers the tokens instead when the escrow ceiling is full, never blocking the buy", async () => {
    const { book, owner, alice, keeper, stock, setPrice } = await loadFixture(deploy);
    await book.connect(owner).setEscrowCaps(stock.target, STOCK(5), 0);
    await book.connect(alice).createLimitBuyWithExits(stock.target, USDC(900), P(90), STOCK(9), await expiryIn(DAY), exits(110, 80));
    await setPrice(90);
    await expect(book.connect(keeper).executeOrder(1)).to.emit(book, "ExitsSkipped").withArgs(1, 3);
    expect(await book.stockEscrowed(stock.target)).to.equal(0);
  });

  it("cancelling the buy refunds the quote and clears the exits", async () => {
    const { book, alice, stock, usdc } = await loadFixture(deploy);
    await book.connect(alice).createLimitBuyWithExits(stock.target, USDC(900), P(90), STOCK(9), await expiryIn(DAY), exits(110, 80));
    const before = await usdc.balanceOf(alice.address);
    await book.connect(alice).cancelOrder(1);
    expect((await usdc.balanceOf(alice.address)) - before).to.equal(USDC(900));
    expect((await book.attachedExits(1)).takeProfitPrice).to.equal(0);
    expect(await book.quoteEscrowed(stock.target)).to.equal(0);
  });
});
