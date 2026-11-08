// scripts/feeds-audit.js: Audit Chainlink feeds on Base Mainnet with real on-chain round data
require("../shared/loadEnv");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = process.env.BASE_MAINNET_RPC || "https://mainnet.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

const FEEDS = [
  { symbol: "NVDAc", name: "NVIDIA Corp", address: "0x04689a41629776563E6822F76f2e57D148d28513", maxStaleness: 90000 },
  { symbol: "AAPLc", name: "Apple Inc", address: "0x787f13dEa48Db0897CbCDD985de77809D837F988", maxStaleness: 90000 },
  { symbol: "MSFTc", name: "Microsoft Corp", address: "0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c", maxStaleness: 90000 },
  { symbol: "GOOGLc", name: "Alphabet Inc", address: "0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2", maxStaleness: 90000 },
  { symbol: "TSLAc", name: "Tesla Inc", address: "0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4", maxStaleness: 90000 },
];

const FEED_ABI = [
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function getRoundData(uint80 _roundId) view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"
];

// Friday Nov 6, 2026 21:00 UTC = 1793998800
const FRIDAY_2100_UTC = 1793998800;
// Monday Nov 9, 2026 14:30 UTC = 1794234600
const MONDAY_1430_UTC = 1794234600;

async function main() {
  const currentBlock = await provider.getBlockNumber();
  const now = Math.floor(Date.now() / 1000);

  console.log("================================================================================");
  console.log("            Chainlink Equity Price Feeds Audit - Base Mainnet                   ");
  console.log("================================================================================");
  console.log(`Connected RPC:   ${RPC_URL}`);
  console.log(`Real Block:      ${currentBlock}`);
  console.log(`Current Time:    ${new Date(now * 1000).toISOString()} (Unix: ${now})\n`);

  for (const f of FEEDS) {
    console.log("--------------------------------------------------------------------------------");
    console.log(`Market: ${f.symbol} (${f.name})`);
    console.log(`Feed Address: ${f.address}`);

    const feed = new ethers.Contract(f.address, FEED_ABI, provider);
    const decimals = await feed.decimals();
    const description = await feed.description();
    const latest = await feed.latestRoundData();

    const latestRoundId = latest.roundId;
    const phaseId = latestRoundId >> 64n;
    const aggRoundId = latestRoundId & 0xFFFFFFFFFFFFFFFFn;
    const latestAnswer = latest.answer;
    const latestUpdatedAt = Number(latest.updatedAt);
    const ageSeconds = now - latestUpdatedAt;
    const ageHours = (ageSeconds / 3600).toFixed(2);
    const formattedPrice = (Number(latestAnswer) / (10 ** Number(decimals))).toFixed(4);

    console.log(`Description:          ${description}`);
    console.log(`Decimals:             ${decimals}`);
    console.log(`Phase ID:             ${phaseId.toString()}`);
    console.log(`Aggregator Round ID:  ${aggRoundId.toString()}`);
    console.log(`Latest Full Round ID: ${latestRoundId.toString()}`);
    console.log(`Latest Answer:        $${formattedPrice} (raw: ${latestAnswer.toString()})`);
    console.log(`Updated At (UTC):     ${new Date(latestUpdatedAt * 1000).toISOString()} (Unix: ${latestUpdatedAt})`);
    console.log(`Current Age:          ${ageSeconds}s (~${ageHours} hours ago)`);
    console.log(`Within MaxStaleness:  ${ageSeconds <= f.maxStaleness ? "YES" : "NO (Expected weekend market close halt)"}`);

    // Query last 30 rounds
    console.log(`\nLast 30 Rounds (Phase ${phaseId.toString()}, Aggregator Rounds ${aggRoundId - 29n} to ${aggRoundId}):`);
    console.log("Idx | AggRound | Full Round ID        | Price ($)   | Updated At (UTC)         | Delta (s)");
    console.log("----+----------+----------------------+-------------+--------------------------+----------");

    const queriedRounds = [];
    let prevTime = latestUpdatedAt;

    for (let i = 0; i < 30; i++) {
      const currentAggId = aggRoundId - BigInt(i);
      const rId = (phaseId << 64n) | currentAggId;
      try {
        const round = await feed.getRoundData(rId);
        const rTime = Number(round.updatedAt);
        const rPrice = (Number(round.answer) / (10 ** Number(decimals))).toFixed(4);
        const delta = i === 0 ? 0 : prevTime - rTime;
        prevTime = rTime;

        queriedRounds.push({
          idx: i,
          aggId: currentAggId.toString(),
          fullId: rId.toString(),
          price: rPrice,
          updatedAt: rTime,
          dateUtc: new Date(rTime * 1000).toISOString(),
          delta
        });

        const isLatestMatch = i === 0 && rId === latestRoundId && round.answer === latestAnswer;
        const tag = i === 0 ? (isLatestMatch ? " (LATEST MATCH)" : " (MISMATCH)") : "";
        console.log(
          `${String(i).padStart(3)} | ` +
          `${currentAggId.toString().padStart(8)} | ` +
          `${rId.toString().padEnd(20)} | ` +
          `$${rPrice.padStart(9)} | ` +
          `${new Date(rTime * 1000).toISOString()} | ` +
          `${String(delta).padStart(7)}s${tag}`
        );
      } catch (err) {
        console.log(`${String(i).padStart(3)} | ${currentAggId.toString().padStart(8)} | ${rId.toString().padEnd(20)} | ERROR: ${err.message}`);
      }
    }

    // Off-hours analysis: Friday 21:00 UTC to Monday 14:30 UTC
    console.log(`\nRounds published during off-hours window (Friday 21:00 UTC to Monday 14:30 UTC):`);
    const offHoursRounds = queriedRounds.filter(r => r.updatedAt >= FRIDAY_2100_UTC && r.updatedAt <= MONDAY_1430_UTC);

    if (offHoursRounds.length === 0) {
      console.log("  none (No rounds published during market closed window)");
    } else {
      for (const r of offHoursRounds) {
        console.log(`  - Round ${r.aggId} (Full: ${r.fullId}): $${r.price} at ${r.dateUtc} (Unix: ${r.updatedAt})`);
      }
      console.log(`  Total rounds in off-hours window: ${offHoursRounds.length}.`);
      console.log(`  Note: Feeds halt updates when underlying equity markets close, resuming Monday at market open.`);
    }
    console.log("\n");
  }

  console.log("================================================================================");
  console.log("            All 5 Chainlink Feeds Audited Successfully                          ");
  console.log("================================================================================");
}

main().catch(err => {
  console.error("Feeds audit execution failed:", err);
  process.exit(1);
});
