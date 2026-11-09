const { ethers } = require("hardhat");

/**
 * Deploys LimitOrderBook + UniswapV3Adapter and wires one or all configured markets.
 * Returns { book, adapter }.
 */
async function deployAll(cfg) {
  const [deployer] = await ethers.getSigners();
  const owner = cfg.owner || deployer.address;
  const book = await (await ethers.getContractFactory("LimitOrderBook")).deploy(
    cfg.quoteToken,
    owner,
    cfg.keeperFeeBps ?? 10
  );
  await book.waitForDeployment();

  const adapter = await (await ethers.getContractFactory("UniswapV3Adapter")).deploy(
    book.target,
    cfg.router,
    owner
  );
  await adapter.waitForDeployment();

  // If cfg.markets array is provided, wire all configured markets
  if (Array.isArray(cfg.markets) && cfg.markets.length > 0) {
    for (const m of cfg.markets) {
      const stockAddr = ethers.getAddress(m.stockToken);
      const quoteAddr = ethers.getAddress(cfg.quoteToken);
      const feedAddr = ethers.getAddress(m.feed);
      const poolFee = Number(m.poolFee);
      const maxStaleness = Number(m.maxStaleness ?? cfg.maxStaleness ?? 90000);
      const maxDeviationBps = Number(m.maxDeviationBps ?? cfg.maxDeviationBps ?? 300);
      const maxStockIn = BigInt(m.maxStockIn);
      const maxQuoteIn = BigInt(m.maxQuoteIn);

      await (await adapter.setPoolFee(stockAddr, quoteAddr, poolFee)).wait();
      await (await book.setMarket(
        stockAddr,
        feedAddr,
        maxStaleness,
        adapter.target,
        maxStockIn,
        maxQuoteIn,
        maxDeviationBps,
        true
      )).wait();
    }
  } else if (cfg.stockToken) {
    // Backwards-compatible single market flow
    await (await adapter.setPoolFee(cfg.stockToken, cfg.quoteToken, cfg.poolFee)).wait();
    await (await book.setMarket(
      cfg.stockToken,
      cfg.feed,
      cfg.maxStaleness,
      adapter.target,
      cfg.maxStockIn,
      cfg.maxQuoteIn,
      cfg.maxDeviationBps ?? 300,
      true
    )).wait();
  }

  return { book, adapter };
}

module.exports = { deployAll };
