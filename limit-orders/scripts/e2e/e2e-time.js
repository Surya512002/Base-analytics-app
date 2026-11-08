const { ethers } = require("hardhat");
async function main() {
  await ethers.provider.send("evm_increaseTime", [3700]);
  await ethers.provider.send("evm_mine", []);
  console.log("advanced chain time by 3700s");
}
main().catch((e) => { console.error(e); process.exit(1); });
