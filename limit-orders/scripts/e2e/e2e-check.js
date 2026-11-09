const { ethers } = require("hardhat");
const a = JSON.parse(require("fs").readFileSync("/tmp/e2e.json"));
const ST = ["NONE", "OPEN", "EXECUTED", "CANCELLED", "EXPIRED"];
const TY = ["LIMIT_BUY", "LIMIT_SELL(TP)", "STOP_LOSS", "TRAILING_STOP"];
async function main() {
  const book = await ethers.getContractAt("LimitOrderBook", a.book);
  const stock = await ethers.getContractAt("MockERC20", a.stock);
  const usdc = await ethers.getContractAt("MockERC20", a.usdc);
  for (const id of [1, 2, 3]) {
    const o = await book.getOrder(id);
    console.log(`order ${id} ${TY[Number(o.orderType)]}: ${ST[Number(o.status)]}  trigger=$${Number(o.triggerPrice) / 1e8}  peak=$${Number(o.peakPrice) / 1e8}`);
  }
  const p = await book.getPlan(1);
  console.log(`plan 1: ${ST[Number(p.status)]}  remaining=${p.remaining}`);
  console.log("alice stock:", ethers.formatUnits(await stock.balanceOf(a.alice), 18), " alice USDC:", ethers.formatUnits(await usdc.balanceOf(a.alice), 6));
}
main().catch((e) => { console.error(e); process.exit(1); });
