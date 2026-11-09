// TESTNET ONLY. Moves the mock price (and the mock pool rate) so you can trigger orders on purpose.
// Usage: FEED=0x.. ADAPTER=0x.. STOCK=0x.. QUOTE=0x.. PRICE=85 npx hardhat run scripts/testnet-set-price.js --network baseSepolia
require("../shared/loadEnv");
const { ethers } = require("hardhat");
async function main() {
  const need = (n) => { if (!process.env[n]) throw new Error(`Missing ${n}`); return process.env[n]; };
  const p = BigInt(Math.round(Number(need("PRICE")) * 1e8));
  const feed = await ethers.getContractAt("MockFeed", need("FEED"));
  const adapter = await ethers.getContractAt("MockAdapter", need("ADAPTER"));
  await (await adapter.setRate(need("QUOTE"), need("STOCK"), 10n ** 20n, p)).wait();
  await (await adapter.setRate(need("STOCK"), need("QUOTE"), p, 10n ** 20n)).wait();
  await (await feed.setAnswer(p)).wait();
  console.log("price set to $" + process.env.PRICE);
}
main().catch((e) => { console.error(e); process.exit(1); });
