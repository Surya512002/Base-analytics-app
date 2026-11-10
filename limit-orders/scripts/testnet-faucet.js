// Usage:
//   TO=0x1234... npx hardhat run scripts/testnet-faucet.js --network baseSepolia
require("../shared/loadEnv");
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

async function main() {
  const net = await ethers.provider.getNetwork();
  if (Number(net.chainId) !== 84532 && Number(net.chainId) !== 31337) {
    throw new Error(`testnet-faucet must run on Base Sepolia (84532) or local hardhat (31337). Found chainId: ${net.chainId}`);
  }

  const recipient = process.env.TO || process.argv[2];
  if (!recipient || !ethers.isAddress(recipient)) {
    throw new Error("Usage: TO=0x... npx hardhat run scripts/testnet-faucet.js --network baseSepolia");
  }

  const depPath = path.resolve(__dirname, "../../src/config/sepoliaDeployment.json");
  if (!fs.existsSync(depPath)) {
    throw new Error(`Deployment file not found at ${depPath}`);
  }
  const deployment = JSON.parse(fs.readFileSync(depPath, "utf8"));

  console.log(`\n--- Testnet Faucet: Minting All Mock Tokens on ${network.name} ---`);
  console.log(`Recipient:   ${recipient}`);

  const [deployer] = await ethers.getSigners();
  console.log(`Calling from minter/deployer: ${deployer.address}\n`);

  // 1. Mint 100,000 mUSDC (6 decimals)
  const quoteToken = await ethers.getContractAt("MockERC20", deployment.quoteToken.address, deployer);
  const quoteMintAmt = ethers.parseUnits("100000", deployment.quoteToken.decimals);
  console.log(`Minting 100,000 ${deployment.quoteToken.symbol} (${deployment.quoteToken.decimals} dec)...`);
  const txQuote = await quoteToken.mint(recipient, quoteMintAmt);
  await txQuote.wait();
  console.log(`  Confirmed! Tx: ${txQuote.hash}`);

  // 2. Mint 1,000 of every stock token in deployment
  for (const market of deployment.markets) {
    const stockToken = await ethers.getContractAt("MockERC20", market.stockToken, deployer);
    const stockMintAmt = ethers.parseUnits("1000", market.decimals);
    console.log(`Minting 1,000 ${market.symbol} (${market.decimals} dec)...`);
    const txStock = await stockToken.mint(recipient, stockMintAmt);
    await txStock.wait();
    console.log(`  Confirmed! Tx: ${txStock.hash}`);
  }

  // Print final recipient balances
  console.log(`\n--- Recipient Token Balances ---`);
  const quoteBal = await quoteToken.balanceOf(recipient);
  console.log(`  ${deployment.quoteToken.symbol}: ${ethers.formatUnits(quoteBal, deployment.quoteToken.decimals)}`);

  for (const market of deployment.markets) {
    const stockToken = await ethers.getContractAt("MockERC20", market.stockToken, deployer);
    const stockBal = await stockToken.balanceOf(recipient);
    console.log(`  ${market.symbol}: ${ethers.formatUnits(stockBal, market.decimals)}`);
  }
  console.log(`\nFaucet minting completed successfully.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
