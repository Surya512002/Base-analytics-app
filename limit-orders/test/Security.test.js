// Pre-mainnet security review: each block encodes an attack and asserts it now fails.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const P = (usd) => BigInt(Math.round(usd * 1e8));
const STOCK = (n) => ethers.parseUnits(String(n), 18);
const USDC = (n) => ethers.parseUnits(String(n), 6);
const T = { LIMIT_BUY: 0, LIMIT_SELL: 1, STOP_LOSS: 2 };
const DAY = 86400;

async function deploy() {
  const [owner, alice, bob, keeper, attacker] = await ethers.getSigners();
  const ERC = await ethers.getContractFactory("MockERC20");
  const stock = await ERC.deploy("NVDA onchain", "NVDAc", 18);
  const usdc = await ERC.deploy("USD Coin", "USDC", 6);
  const feed = await (await ethers.getContractFactory("MockFeed")).deploy(P(100));
  const adapter = await (await ethers.getContractFactory("MockAdapter")).deploy();
  const book = await (await ethers.getContractFactory("LimitOrderBook")).deploy(usdc.target, owner.address, 10);
  await book.setMarket(stock.target, feed.target, 3600, adapter.target, STOCK(1000), USDC(100000), 300, true);
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
  return { owner, alice, bob, keeper, attacker, stock, usdc, feed, adapter, book, setPrice };
}
const expiryIn = async (s) => BigInt((await time.latest()) + s);

describe("Security: owner cannot instantly re-route user funds", () => {
  it("swapping the feed or adapter, or loosening the oracle bound, on a live market needs the 2-day timelock", async () => {
    const { book, owner, stock, feed, adapter } = await loadFixture(deploy);
    const evilFeed = await (await ethers.getContractFactory("MockFeed")).deploy(P(1)); // would make every floor ~0
    const evilAdapter = await (await ethers.getContractFactory("MockAdapter")).deploy(); // would keep the tokens
    const set = (f, a, stale, dev) => book.connect(owner).setMarket(stock.target, f, stale, a, STOCK(1000), USDC(100000), dev, true);
    await expect(set(evilFeed.target, adapter.target, 3600, 300)).to.be.revertedWithCustomError(book, "NeedsTimelock");
    await expect(set(feed.target, evilAdapter.target, 3600, 300)).to.be.revertedWithCustomError(book, "NeedsTimelock");
    await expect(set(feed.target, adapter.target, 3600, 5000)).to.be.revertedWithCustomError(book, "NeedsTimelock");
    await expect(set(feed.target, adapter.target, 999999, 300)).to.be.revertedWithCustomError(book, "NeedsTimelock");
    // Tightening and caps/enable changes stay immediate
    await set(feed.target, adapter.target, 1800, 200);
    await book.connect(owner).setMarket(stock.target, feed.target, 1800, adapter.target, STOCK(1), USDC(1), 200, false);
  });

  it("queued changes are public, cancellable, and only apply after the delay, giving users time to exit", async () => {
    const { book, owner, alice, stock, usdc, feed } = await loadFixture(deploy);
    const evilAdapter = await (await ethers.getContractFactory("MockAdapter")).deploy();
    await book.connect(alice).createOrder(stock.target, T.LIMIT_BUY, USDC(900), P(90), STOCK(9), await expiryIn(5 * DAY));

    await expect(book.connect(owner).queueRiskChange(stock.target, feed.target, evilAdapter.target, 3600, 300)).to.emit(book, "RiskChangeQueued");
    await expect(book.connect(owner).applyRiskChange(stock.target)).to.be.revertedWithCustomError(book, "TimelockNotReady");

    // The user sees the queued change and leaves with everything
    const before = await usdc.balanceOf(alice.address);
    await book.connect(alice).cancelOrder(1);
    expect((await usdc.balanceOf(alice.address)) - before).to.equal(USDC(900));

    await time.increase(2 * DAY + 1);
    await book.connect(owner).applyRiskChange(stock.target);
    expect((await book.markets(stock.target)).adapter).to.equal(evilAdapter.target);

    await book.connect(owner).queueRiskChange(stock.target, feed.target, evilAdapter.target, 3600, 300);
    await book.connect(owner).cancelRiskChange(stock.target);
    await expect(book.connect(owner).applyRiskChange(stock.target)).to.be.revertedWithCustomError(book, "TimelockNotReady");
  });

  it("only the owner can queue or apply risk changes", async () => {
    const { book, attacker, stock, feed, adapter } = await loadFixture(deploy);
    await expect(book.connect(attacker).queueRiskChange(stock.target, feed.target, adapter.target, 3600, 300)).to.be.revertedWithCustomError(book, "OwnableUnauthorizedAccount");
    await expect(book.connect(attacker).applyRiskChange(stock.target)).to.be.revertedWithCustomError(book, "OwnableUnauthorizedAccount");
    await expect(book.connect(attacker).setKeeper(attacker.address, true)).to.be.revertedWithCustomError(book, "OwnableUnauthorizedAccount");
    await expect(book.connect(attacker).setSequencerUptimeFeed(attacker.address)).to.be.revertedWithCustomError(book, "OwnableUnauthorizedAccount");
  });
});

describe("Security: no permissionless atomic sandwich", () => {
  it("strangers cannot execute orders or plans while keeperOnly is on (default)", async () => {
    const { book, alice, attacker, keeper, stock, setPrice } = await loadFixture(deploy);
    expect(await book.keeperOnly()).to.equal(true);
    await book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(10), P(95), USDC(900), await expiryIn(DAY));
    await book.connect(alice).createDca(stock.target, USDC(100), 2, 3600, 0);
    await setPrice(94);
    await expect(book.connect(attacker).executeOrder(1)).to.be.revertedWithCustomError(book, "NotKeeper");
    await expect(book.connect(attacker).executeDca(1)).to.be.revertedWithCustomError(book, "NotKeeper");
    await book.connect(keeper).executeOrder(1);
    await book.connect(keeper).executeDca(1);
  });

  it("the owner can open execution to everyone as a liveness fallback, and revoke keepers", async () => {
    const { book, owner, alice, attacker, keeper, stock, setPrice } = await loadFixture(deploy);
    await book.connect(owner).setKeeper(keeper.address, false);
    await book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(10), P(95), USDC(900), await expiryIn(DAY));
    await setPrice(94);
    await expect(book.connect(keeper).executeOrder(1)).to.be.revertedWithCustomError(book, "NotKeeper");
    await book.connect(owner).setKeeperOnly(false);
    await book.connect(attacker).executeOrder(1);
  });
});

describe("Security: L2 sequencer downtime", () => {
  async function withSequencer() {
    const f = await loadFixture(deploy);
    const seq = await (await ethers.getContractFactory("MockFeed")).deploy(0);
    await seq.setAnswerStale(0, (await time.latest()) - 2 * 3600); // up for 2h
    await f.book.connect(f.owner).setSequencerUptimeFeed(seq.target);
    return { ...f, seq };
  }

  it("blocks execution while the sequencer is down and during the 1h grace period after", async () => {
    const { book, alice, keeper, stock, seq, setPrice } = await withSequencer();
    await book.connect(alice).createOrder(stock.target, T.STOP_LOSS, STOCK(10), P(95), USDC(900), await expiryIn(DAY));
    await setPrice(94);

    await seq.setAnswerStale(1, await time.latest()); // down
    expect(await book.canExecute(1)).to.equal(false);
    await expect(book.connect(keeper).executeOrder(1)).to.be.revertedWithCustomError(book, "SequencerDown");

    await seq.setAnswerStale(0, await time.latest()); // just came back
    await expect(book.connect(keeper).executeOrder(1)).to.be.revertedWithCustomError(book, "SequencerDown");

    await time.increase(3601);
    await setPrice(94);
    expect(await book.canExecute(1)).to.equal(true);
    await book.connect(keeper).executeOrder(1);
  });

  it("users can still cancel while the sequencer feed reports down", async () => {
    const { book, alice, stock, seq } = await withSequencer();
    await book.connect(alice).createOrder(stock.target, T.LIMIT_SELL, STOCK(10), P(110), USDC(1000), await expiryIn(DAY));
    await seq.setAnswerStale(1, await time.latest());
    const before = await stock.balanceOf(alice.address);
    await book.connect(alice).cancelOrder(1);
    expect((await stock.balanceOf(alice.address)) - before).to.equal(STOCK(10));
  });
});

describe("Security: users' funds are theirs only", () => {
  it("nobody else can cancel, edit, or refund early", async () => {
    const { book, alice, attacker, stock } = await loadFixture(deploy);
    await book.connect(alice).createOrder(stock.target, T.LIMIT_SELL, STOCK(10), P(110), USDC(1000), await expiryIn(DAY));
    await book.connect(alice).createDcaSell(stock.target, STOCK(1), 3, 3600, 0);
    await expect(book.connect(attacker).cancelOrder(1)).to.be.revertedWithCustomError(book, "NotOwner");
    await expect(book.connect(attacker).updateOrder(1, P(120), USDC(1100))).to.be.revertedWithCustomError(book, "NotOwner");
    await expect(book.connect(attacker).cancelDca(1)).to.be.revertedWithCustomError(book, "NotOwner");
    await expect(book.connect(attacker).refundExpired(1)).to.be.revertedWithCustomError(book, "NotExpired");
  });

  it("refundExpired by a stranger pays the OWNER, not the caller", async () => {
    const { book, alice, attacker, stock } = await loadFixture(deploy);
    await book.connect(alice).createOrder(stock.target, T.LIMIT_SELL, STOCK(10), P(110), USDC(1000), await expiryIn(DAY));
    await time.increase(DAY + 1);
    const before = await stock.balanceOf(alice.address);
    await book.connect(attacker).refundExpired(1);
    expect((await stock.balanceOf(alice.address)) - before).to.equal(STOCK(10));
    expect(await stock.balanceOf(attacker.address)).to.equal(0);
  });

  it("the guardian and owner cannot withdraw escrow: there is no function that sends user funds to them", async () => {
    const { book } = await loadFixture(deploy);
    const names = book.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
    for (const n of ["withdraw", "sweep", "rescue", "emergencyWithdraw", "transferTokens"]) {
      expect(names).to.not.include(n);
    }
  });
});
