// TESTNET ONLY. Deploys mock stock + USDC tokens, a mock price feed, a mock swap adapter and the LimitOrderBook,
// so the whole UI + keeper flow can be tested on Base Sepolia without real tokenized stocks.
// Usage: npx hardhat run scripts/deploy-testnet-mocks.js --network baseSepolia
require("../shared/loadEnv");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const P = (n) => BigInt(Math.round(Number(n) * 1e8));
  const startPrice = P(process.env.START_PRICE || 100);

  const ERC = await ethers.getContractFactory("MockERC20");
  const stock = await ERC.deploy("Mock NVDA", "mNVDA", 18);
  const usdc = await ERC.deploy("Mock USDC", "mUSDC", 6);
  const feed = await (await ethers.getContractFactory("MockFeed")).deploy(startPrice);
  const adapter = await (await ethers.getContractFactory("MockAdapter")).deploy();
  const book = await (await ethers.getContractFactory("LimitOrderBook")).deploy(usdc.target, deployer.address, 10);
  for (const c of [stock, usdc, feed, adapter, book]) await c.waitForDeployment();

  await (await book.setMarket(stock.target, feed.target, 86400 * 7, adapter.target,
    ethers.parseUnits("1000", 18), ethers.parseUnits("100000", 6), 500, true)).wait();
  await (await stock.mint(adapter.target, ethers.parseUnits("1000000", 18))).wait();
  await (await usdc.mint(adapter.target, ethers.parseUnits("1000000", 6))).wait();
  await (await stock.mint(deployer.address, ethers.parseUnits("1000", 18))).wait();
  await (await usdc.mint(deployer.address, ethers.parseUnits("100000", 6))).wait();
  await (await adapter.setRate(usdc.target, stock.target, 10n ** 20n, startPrice)).wait();
  await (await adapter.setRate(stock.target, usdc.target, startPrice, 10n ** 20n)).wait();

  const out = { orderBook: book.target, stock: stock.target, quote: usdc.target, feed: feed.target, adapter: adapter.target };
  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
