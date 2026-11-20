const { ethers } = require("hardhat");

/**
 * Deploys LimitOrderBook + UniswapV3Adapter and wires one or all configured markets.
 *
 * Ownership: both contracts are deployed with the DEPLOYER as the temporary owner so it can wire markets,
 * pool fees, escrow ceilings and the guardian. If `cfg.owner` is a different address (a Safe on mainnet),
 * ownership is then offered to it with Ownable2Step: the Safe must call `acceptOwnership()` on BOTH contracts.
 * Until it does, the deployer is still the owner, so the deployer key must be kept safe until acceptance.
 *
 * Returns { book, adapter, pendingOwner }.
 */
async function deployAll(cfg) {
  const [deployer] = await ethers.getSigners();
  const finalOwner = cfg.owner ? ethers.getAddress(cfg.owner) : deployer.address;

  const book = await (await ethers.getContractFactory("LimitOrderBook")).deploy(
    cfg.quoteToken,
    deployer.address,
    cfg.keeperFeeBps ?? 10
  );
  await book.waitForDeployment();

  const adapter = await (await ethers.getContractFactory("UniswapV3Adapter")).deploy(
    book.target,
    cfg.router,
    deployer.address
  );
  await adapter.waitForDeployment();

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
      if (m.maxStockEscrow !== undefined || m.maxQuoteEscrow !== undefined) {
        await (await book.setEscrowCaps(stockAddr, BigInt(m.maxStockEscrow ?? 0), BigInt(m.maxQuoteEscrow ?? 0))).wait();
      }
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

  if (cfg.sequencerUptimeFeed) {
    await (await book.setSequencerUptimeFeed(ethers.getAddress(cfg.sequencerUptimeFeed))).wait();
  }
  for (const k of cfg.keepers ?? []) {
    await (await book.setKeeper(ethers.getAddress(k), true)).wait();
  }

  if (cfg.guardian) {
    await (await book.setGuardian(ethers.getAddress(cfg.guardian))).wait();
  }

  let pendingOwner = null;
  if (finalOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    await (await book.transferOwnership(finalOwner)).wait();
    await (await adapter.transferOwnership(finalOwner)).wait();
    pendingOwner = finalOwner;
  }

  return { book, adapter, pendingOwner };
}

module.exports = { deployAll };
