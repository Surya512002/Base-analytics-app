// scripts/h7-live-state.js: Read and print real on-chain state of the Sepolia order book
require("../shared/loadEnv");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

const ORDER_BOOK = "0xC7fBA8EB5442760F83266C32F3Bc2E5c65079e46";
const MOCK_STOCK = "0xCCc66590BA8a67fe51bC2eB552B24f30c30263F2";

const BOOK_ABI = [
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function keeperFeeBps() view returns (uint16)",
  "function nextOrderId() view returns (uint256)",
  "function nextPlanId() view returns (uint256)",
  "function getPlan(uint256 id) view returns (tuple(address owner, uint8 status, uint16 remaining, uint32 interval, uint40 nextTime, address stockToken, uint96 maxPrice, uint128 amountPerBuy))",
  "function markets(address stockToken) view returns (address feed, uint8 feedDecimals, uint8 stockDecimals, bool enabled, uint32 maxStaleness, uint16 maxDeviationBps, address adapter, uint128 maxStockIn, uint128 maxQuoteIn)",
  "function getOrder(uint256 id) view returns (tuple(address owner, uint40 expiry, uint8 orderType, uint8 status, uint16 trailBps, address stockToken, uint96 triggerPrice, uint128 amountIn, uint128 minAmountOut, uint96 peakPrice, uint64 linkedId))"
];

const ORDER_TYPES = ["LIMIT_BUY", "LIMIT_SELL", "STOP_LOSS", "TRAILING_STOP"];
const ORDER_STATUSES = ["NONE", "OPEN", "EXECUTED", "CANCELLED", "EXPIRED"];
const PLAN_STATUSES = ["NONE", "OPEN", "EXECUTED", "CANCELLED"];

async function main() {
  const currentBlock = await provider.getBlockNumber();
  const now = Math.floor(Date.now() / 1000);

  console.log("================================================================================");
  console.log("             Live State Check: Sepolia LimitOrderBook Contract                  ");
  console.log("================================================================================");
  console.log(`OrderBook Address: ${ORDER_BOOK}`);
  console.log(`Connected RPC:     ${RPC_URL}`);
  console.log(`Current Block:     ${currentBlock}`);
  console.log(`Current UTC Time:  ${new Date(now * 1000).toISOString()} (Unix: ${now})\n`);

  const book = new ethers.Contract(ORDER_BOOK, BOOK_ABI, provider);

  // 1. Contract Global State
  const owner = await book.owner();
  const paused = await book.paused();
  const keeperFeeBps = await book.keeperFeeBps();
  const nextOrderId = await book.nextOrderId();
  const nextPlanId = await book.nextPlanId();

  console.log("--- 1. Contract Global State ---");
  console.log(`Owner:         ${owner}`);
  console.log(`Paused:        ${paused}`);
  console.log(`KeeperFeeBps:  ${keeperFeeBps.toString()} (${(Number(keeperFeeBps) / 100).toFixed(2)}%)`);
  console.log(`NextOrderId:   ${nextOrderId.toString()}`);
  console.log(`NextPlanId:    ${nextPlanId.toString()}\n`);

  // 2. Active Market Configuration (mNVDA)
  const mkt = await book.markets(MOCK_STOCK);
  console.log("--- 2. Market State for Mock Stock (mNVDA) ---");
  console.log(`Stock Token:     ${MOCK_STOCK}`);
  console.log(`Feed:            ${mkt.feed}`);
  console.log(`Feed Decimals:   ${mkt.feedDecimals}`);
  console.log(`Stock Decimals:  ${mkt.stockDecimals}`);
  console.log(`Enabled:         ${mkt.enabled}`);
  console.log(`MaxStaleness:    ${mkt.maxStaleness.toString()}s`);
  console.log(`MaxDeviationBps: ${mkt.maxDeviationBps.toString()} bps`);
  console.log(`Adapter:         ${mkt.adapter}`);
  console.log(`MaxStockIn:      ${mkt.maxStockIn.toString()} raw (${ethers.formatUnits(mkt.maxStockIn, 18)} mNVDA)`);
  console.log(`MaxQuoteIn:      ${mkt.maxQuoteIn.toString()} raw (${ethers.formatUnits(mkt.maxQuoteIn, 6)} mUSDC)\n`);

  // 3. DCA Plan 1 State
  const plan1 = await book.getPlan(1);
  const planStatusStr = PLAN_STATUSES[plan1.status] || "UNKNOWN";
  const nextTime = Number(plan1.nextTime);
  console.log("--- 3. DCA Plan 1 On-Chain State ---");
  console.log(`Plan ID:         1`);
  console.log(`Owner:           ${plan1.owner}`);
  console.log(`Status:          ${planStatusStr} (${plan1.status})`);
  console.log(`Remaining Buys:  ${plan1.remaining.toString()}`);
  console.log(`Interval:        ${plan1.interval.toString()}s (${(Number(plan1.interval) / 3600).toFixed(1)}h)`);
  console.log(`Next Execution:  ${nextTime} (${new Date(nextTime * 1000).toISOString()})`);
  console.log(`Stock Token:     ${plan1.stockToken}`);
  console.log(`Max Price Cap:   ${plan1.maxPrice.toString() === "0" ? "None (0)" : "$" + (Number(plan1.maxPrice) / 1e8).toFixed(2)}`);
  console.log(`Amount Per Buy:  ${ethers.formatUnits(plan1.amountPerBuy, 6)} mUSDC\n`);

  // 4. Statuses of Every Order ID
  console.log("--- 4. All Orders On-Chain Statuses ---");
  console.log("Order ID | Type          | Status    | Trigger Price | Amount In               | Owner");
  console.log("---------+---------------+-----------+---------------+-------------------------+-------------------------------------------");

  const rawOrders = [];
  for (let i = 1; i < Number(nextOrderId); i++) {
    const o = await book.getOrder(i);
    const typeStr = ORDER_TYPES[o.orderType] || `TYPE_${o.orderType}`;
    const statusStr = ORDER_STATUSES[o.status] || `STATUS_${o.status}`;
    const triggerStr = "$" + (Number(o.triggerPrice) / 1e8).toFixed(2);
    const amountStr = o.amountIn.toString();

    rawOrders.push({
      id: i,
      owner: o.owner,
      expiry: o.expiry.toString(),
      orderType: o.orderType,
      orderTypeStr: typeStr,
      status: o.status,
      statusStr: statusStr,
      trailBps: o.trailBps.toString(),
      stockToken: o.stockToken,
      triggerPrice: o.triggerPrice.toString(),
      amountIn: o.amountIn.toString(),
      minAmountOut: o.minAmountOut.toString(),
      peakPrice: o.peakPrice.toString(),
      linkedId: o.linkedId.toString()
    });

    console.log(
      `Order ${String(i).padStart(2)} | ` +
      `${typeStr.padEnd(13)} | ` +
      `${statusStr.padEnd(9)} | ` +
      `${triggerStr.padStart(13)} | ` +
      `${amountStr.padStart(23)} | ` +
      `${o.owner}`
    );
  }

  // 5. Output Raw RPC Response JSON
  console.log("\n--- 5. Raw RPC JSON Dump ---");
  const rawState = {
    contract: ORDER_BOOK,
    blockNumber: currentBlock,
    timestamp: now,
    global: {
      owner,
      paused,
      keeperFeeBps: keeperFeeBps.toString(),
      nextOrderId: nextOrderId.toString(),
      nextPlanId: nextPlanId.toString()
    },
    market: {
      stockToken: MOCK_STOCK,
      feed: mkt.feed,
      feedDecimals: Number(mkt.feedDecimals),
      stockDecimals: Number(mkt.stockDecimals),
      enabled: mkt.enabled,
      maxStaleness: mkt.maxStaleness.toString(),
      maxDeviationBps: mkt.maxDeviationBps.toString(),
      adapter: mkt.adapter,
      maxStockIn: mkt.maxStockIn.toString(),
      maxQuoteIn: mkt.maxQuoteIn.toString()
    },
    dcaPlan1: {
      owner: plan1.owner,
      status: Number(plan1.status),
      remaining: Number(plan1.remaining),
      interval: Number(plan1.interval),
      nextTime: Number(plan1.nextTime),
      stockToken: plan1.stockToken,
      maxPrice: plan1.maxPrice.toString(),
      amountPerBuy: plan1.amountPerBuy.toString()
    },
    orders: rawOrders
  };

  console.log(JSON.stringify(rawState, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
}

main().catch(err => {
  console.error("Live state check execution failed:", err);
  process.exit(1);
});
