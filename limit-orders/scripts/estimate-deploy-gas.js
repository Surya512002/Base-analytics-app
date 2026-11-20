/**
 * Estimate the gas a real mainnet deploy will cost, by running the production deploy path on a local fork
 * while impersonating the deployer address (no key needed, nothing is broadcast).
 *
 *   DEPLOYER_ADDRESS=0x... OWNER_ADDRESS=0x... npx hardhat run scripts/estimate-deploy-gas.js
 */
const { ethers, network } = require("hardhat");
const path = require("path");

const FORK_RPC = process.env.BASE_FORK_RPC || "https://mainnet.base.org";

async function main() {
  const deployerAddr = ethers.getAddress(process.env.DEPLOYER_ADDRESS);
  const owner = ethers.getAddress(process.env.OWNER_ADDRESS || "0x000000000000000000000000000000000000dEaD");
  const live = new ethers.JsonRpcProvider(FORK_RPC);
  const liveBalance = await live.getBalance(deployerAddr);
  const feeData = await live.getFeeData(); // live Base gas price, not the fork default
  await network.provider.request({ method: "hardhat_reset", params: [{ forking: { jsonRpcUrl: FORK_RPC } }] });

  await network.provider.request({ method: "hardhat_impersonateAccount", params: [deployerAddr] });
  await network.provider.send("hardhat_setBalance", [deployerAddr, "0x56BC75E2D63100000"]);
  const signer = await ethers.getSigner(deployerAddr);

  const cfg = require(path.join(__dirname, "../config/mainnet-canary.json"));
  const coins = cfg.markets.filter((m) => m.kind === "coin");
  const stocks = cfg.markets.filter((m) => m.kind !== "coin");

  let gas = 0n;
  const track = async (txPromise) => {
    const tx = await txPromise;
    const r = await tx.wait();
    gas += r.gasUsed;
    return r;
  };

  const Book = await ethers.getContractFactory("LimitOrderBook", signer);
  const book = await Book.deploy(cfg.quoteToken, deployerAddr, cfg.keeperFeeBps);
  gas += (await book.deploymentTransaction().wait()).gasUsed;
  const Adapter = await ethers.getContractFactory("UniswapV3Adapter", signer);
  const adapter = await Adapter.deploy(book.target, cfg.router, deployerAddr);
  gas += (await adapter.deploymentTransaction().wait()).gasUsed;
  const deployGas = gas;

  let perMarket = 0n;
  for (const m of coins) {
    const before = gas;
    await track(adapter.setPoolFee(m.stockToken, cfg.quoteToken, m.poolFee));
    await track(book.setMarket(m.stockToken, m.feed, m.maxStaleness, adapter.target, m.maxStockIn, m.maxQuoteIn, m.maxDeviationBps, true));
    await track(book.setEscrowCaps(m.stockToken, m.maxStockEscrow, m.maxQuoteEscrow));
    perMarket = gas - before;
  }
  await track(book.setGuardian(owner));
  await track(book.transferOwnership(owner));
  await track(adapter.transferOwnership(owner));

  // Stocks cannot execute locally (B20 precompile); estimate them at the same cost as a coin market.
  const total = gas + perMarket * BigInt(stocks.length);
  const price = feeData.gasPrice ?? 10_000_000n;
  const fmt = (wei) => ethers.formatEther(wei);
  const l1Buffer = ethers.parseEther("0.0003"); // Base also charges an L1 data fee per tx; contract creation is the bulk of it

  console.log(`Deployer ${deployerAddr}: live balance ${fmt(liveBalance)} ETH`);
  console.log(`Contracts: ${deployGas} gas | per market: ${perMarket} gas | markets: ${cfg.markets.length}`);
  console.log(`Total L2 gas: ${total} at ${Number(price) / 1e9} gwei = ${fmt(total * price)} ETH`);
  console.log(`With a 2x gas-price margin plus an L1 data-fee buffer: ~${fmt(total * price * 2n + l1Buffer)} ETH`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
