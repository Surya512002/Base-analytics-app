// Usage:
//   TO=0x1234... npx hardhat run scripts/testnet-faucet.js --network baseSepolia
//   TO=0x1234... STOCK_TOKEN=0x... QUOTE_TOKEN=0x... npx hardhat run scripts/testnet-faucet.js --network baseSepolia

const { ethers, network } = require("hardhat");

async function main() {
  const recipient = process.env.TO || process.argv[2];
  if (!recipient || !ethers.isAddress(recipient)) {
    throw new Error("Usage: TO=0x... npx hardhat run scripts/testnet-faucet.js --network baseSepolia");
  }

  // Base Sepolia default mock addresses from active deployment
  const stockAddr = process.env.STOCK_TOKEN || process.env.MNVDA_ADDRESS || "0xCCc66590BA8a67fe51bC2eB552B24f30c30263F2";
  const quoteAddr = process.env.QUOTE_TOKEN || process.env.MUSDC_ADDRESS || "0x19468e9fe5dBfdbD786D9b09Da7caC07c1367187";

  console.log(`\n--- Testnet Faucet: Minting Mock Tokens on ${network.name} ---`);
  console.log(`Recipient:   ${recipient}`);
  console.log(`Stock Token: ${stockAddr}`);
  console.log(`Quote Token: ${quoteAddr}\n`);

  const [deployer] = await ethers.getSigners();
  console.log(`Calling from minter/deployer: ${deployer.address}`);

  const stock = await ethers.getContractAt("MockERC20", stockAddr, deployer);
  const quote = await ethers.getContractAt("MockERC20", quoteAddr, deployer);

  // Mint 1,000 mNVDA (18 decimals)
  const stockAmount = ethers.parseUnits("1000", 18);
  console.log("Minting 1,000 mNVDA...");
  const txStock = await stock.mint(recipient, stockAmount);
  await txStock.wait();
  console.log(`mNVDA minted! Tx: ${txStock.hash}`);

  // Mint 100,000 mUSDC (6 decimals)
  const quoteAmount = ethers.parseUnits("100000", 6);
  console.log("Minting 100,000 mUSDC...");
  const txQuote = await quote.mint(recipient, quoteAmount);
  await txQuote.wait();
  console.log(`mUSDC minted! Tx: ${txQuote.hash}`);

  const stockBal = await stock.balanceOf(recipient);
  const quoteBal = await quote.balanceOf(recipient);
  console.log(`\nNew Recipient Balances:`);
  console.log(`  mNVDA: ${ethers.formatUnits(stockBal, 18)}`);
  console.log(`  mUSDC: ${ethers.formatUnits(quoteBal, 6)}\n`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
