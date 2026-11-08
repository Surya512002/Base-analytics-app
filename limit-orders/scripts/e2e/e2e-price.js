// PRICE=120 npx hardhat run scripts/e2e/e2e-price.js --network localhost
const { ethers } = require("hardhat");
const a = JSON.parse(require("fs").readFileSync("/tmp/e2e.json"));
async function main() {
  const p = BigInt(Math.round(Number(process.env.PRICE) * 1e8));
  const feed = await ethers.getContractAt("MockFeed", a.feed);
  const adapter = await ethers.getContractAt("MockAdapter", a.adapter);
  await adapter.setRate(a.usdc, a.stock, 10n ** 20n, p);
  await adapter.setRate(a.stock, a.usdc, p, 10n ** 20n);
  await feed.setAnswer(p);
  console.log("price set to $" + process.env.PRICE);
}
main().catch((e) => { console.error(e); process.exit(1); });
