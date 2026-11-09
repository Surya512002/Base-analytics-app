// Local end-to-end scenario: trailing stop + bracket (take-profit / stop-loss) + DCA plan, all for the same user.
const { ethers } = require("hardhat");
const fs = require("fs");
const P = (n) => BigInt(n) * 10n ** 8n;
async function main() {
  const [owner, alice] = await ethers.getSigners();
  const ERC = await ethers.getContractFactory("MockERC20");
  const stock = await ERC.deploy("NVDA", "NVDAc", 18), usdc = await ERC.deploy("USDC", "USDC", 6);
  const feed = await (await ethers.getContractFactory("MockFeed")).deploy(P(100));
  const adapter = await (await ethers.getContractFactory("MockAdapter")).deploy();
  const book = await (await ethers.getContractFactory("LimitOrderBook")).deploy(usdc.target, owner.address, 10);
  await book.setMarket(stock.target, feed.target, 3600, adapter.target, ethers.parseUnits("1000", 18), ethers.parseUnits("100000", 6), 500, true);
  await stock.mint(adapter.target, ethers.parseUnits("1000000", 18));
  await usdc.mint(adapter.target, ethers.parseUnits("1000000", 6));
  await adapter.setRate(usdc.target, stock.target, 10n ** 20n, P(100));
  await adapter.setRate(stock.target, usdc.target, P(100), 10n ** 20n);
  await stock.mint(alice.address, ethers.parseUnits("100", 18));
  await usdc.mint(alice.address, ethers.parseUnits("1000", 6));
  await stock.connect(alice).approve(book.target, ethers.MaxUint256);
  await usdc.connect(alice).approve(book.target, ethers.MaxUint256);
  const now = (await ethers.provider.getBlock("latest")).timestamp;
  const exp = now + 86400;
  const S = (n) => ethers.parseUnits(String(n), 18), U = (n) => ethers.parseUnits(String(n), 6);
  await book.connect(alice).createTrailingStop(stock.target, S(10), 1000, U(800), exp);             // order 1
  await book.connect(alice).createBracket(stock.target, S(5), P(110), P(90), U(500), U(400), exp);  // orders 2 (TP) and 3 (SL)
  await book.connect(alice).createDca(stock.target, U(100), 3, 3600, 0);                            // plan 1
  fs.writeFileSync("/tmp/e2e.json", JSON.stringify({ book: book.target, stock: stock.target, usdc: usdc.target, feed: feed.target, adapter: adapter.target, alice: alice.address }));
  console.log("setup done, book:", book.target);
}
main().catch((e) => { console.error(e); process.exit(1); });
