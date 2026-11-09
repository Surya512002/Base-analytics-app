const { expect } = require("chai");
const { ethers } = require("hardhat");
const { dryRunMock } = require("../scripts/deploy");

describe("Deploy dry run on in-process Hardhat network", () => {
  it("deploys book, adapter, and sets up ALL configured markets with beta caps", async () => {
    const { book, adapter, markets, mockUsdc } = await dryRunMock();

    expect(book.target).to.properAddress;
    expect(adapter.target).to.properAddress;
    expect(markets.length).to.equal(3);

    for (const m of markets) {
      const market = await book.markets(m.stockToken);
      expect(market.enabled).to.equal(true);
      expect(market.adapter).to.equal(adapter.target);
      expect(market.feed).to.equal(m.feed);
      expect(market.maxStockIn).to.equal(BigInt(m.maxStockIn));
      expect(market.maxQuoteIn).to.equal(BigInt(m.maxQuoteIn));

      // Check pool fee in adapter
      const stockAddr = m.stockToken;
      const quoteAddr = mockUsdc.target;
      const key = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "address"],
          stockAddr.toLowerCase() < quoteAddr.toLowerCase()
            ? [stockAddr, quoteAddr]
            : [quoteAddr, stockAddr]
        )
      );
      expect(await adapter.poolFee(key)).to.equal(m.poolFee);
    }

    // Verify enforcement of beta caps on the deployed market
    const [deployer, alice] = await ethers.getSigners();
    const stock0 = await ethers.getContractAt("MockERC20", markets[0].stockToken);
    await stock0.mint(alice.address, ethers.parseUnits("10", 18));
    await stock0.connect(alice).approve(book.target, ethers.MaxUint256);

    // MaxStockIn is 1 ether (1 whole stock). Attempting 1.1 ether must revert AmountTooLarge
    const expiry = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    const P = (n) => BigInt(Math.round(Number(n) * 1e8));
    await expect(
      book.connect(alice).createOrder(
        markets[0].stockToken,
        2, // STOP_LOSS
        ethers.parseUnits("1.1", 18),
        P(170),
        1,
        expiry
      )
    ).to.be.revertedWithCustomError(book, "AmountTooLarge");

    // Quote cap is 100 USDC. Attempting 101 USDC must revert AmountTooLarge
    await mockUsdc.mint(alice.address, ethers.parseUnits("500", 6));
    await mockUsdc.connect(alice).approve(book.target, ethers.MaxUint256);
    await expect(
      book.connect(alice).createOrder(
        markets[0].stockToken,
        0, // LIMIT_BUY
        ethers.parseUnits("101", 6),
        P(170),
        1,
        expiry
      )
    ).to.be.revertedWithCustomError(book, "AmountTooLarge");
  });
});
