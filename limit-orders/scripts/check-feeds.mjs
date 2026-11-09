import { createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

const PROXY_ABI = parseAbi([
  "function description() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function getRoundData(uint80 _roundId) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function aggregator() external view returns (address)",
  "function owner() external view returns (address)",
  "function phaseId() external view returns (uint16)",
]);

const FEEDS = [
  { symbol: "AAPL", address: "0x787f13dEa48Db0897CbCDD985de77809D837F988" },
  { symbol: "NVDA", address: "0x04689a41629776563E6822F76f2e57D148d28513" },
  { symbol: "TSLA", address: "0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4" },
  { symbol: "MSFT", address: "0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c" },
  { symbol: "GOOGL", address: "0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2" },
];

async function checkFeed(f) {
  console.log(`\n======================================================`);
  console.log(`Feed: ${f.symbol} (${f.address})`);
  console.log(`======================================================`);

  try {
    const desc = await client.readContract({ address: f.address, abi: PROXY_ABI, functionName: "description" });
    const dec = await client.readContract({ address: f.address, abi: PROXY_ABI, functionName: "decimals" });
    let agg = "n/a";
    let owner = "n/a";
    let phase = 1;
    try {
      agg = await client.readContract({ address: f.address, abi: PROXY_ABI, functionName: "aggregator" });
    } catch {}
    try {
      owner = await client.readContract({ address: f.address, abi: PROXY_ABI, functionName: "owner" });
    } catch {}
    try {
      phase = await client.readContract({ address: f.address, abi: PROXY_ABI, functionName: "phaseId" });
    } catch {}

    const latest = await client.readContract({ address: f.address, abi: PROXY_ABI, functionName: "latestRoundData" });
    const now = Math.floor(Date.now() / 1000);
    const ageSec = now - Number(latest[3]);
    const ageHours = (ageSec / 3600).toFixed(2);

    console.log(`Description: "${desc}", Decimals: ${dec}`);
    console.log(`Current Aggregator: ${agg}`);
    console.log(`Proxy Owner: ${owner}`);
    console.log(`Current Phase: ${phase}`);
    console.log(`Latest Price: $${(Number(latest[1]) / 10 ** dec).toFixed(2)}`);
    console.log(`Latest UpdatedAt: ${latest[3]} (Age right now: ${ageSec}s / ${ageHours} hours ago)`);
    console.log(`Current Date/Time: ${new Date().toISOString()}`);

    // Read last ~30 rounds
    const roundId = latest[0];
    const phaseIdBig = roundId >> 64n;
    const aggRoundId = roundId & 0xFFFFFFFFFFFFFFFFn;

    console.log(`\nLast 30 Rounds:`);
    console.log(`Index | RoundId | Price | UpdatedAt (UTC) | Time Delta from Prev`);

    const rounds = [];
    for (let i = 0; i < 30; i++) {
      const targetAggRound = aggRoundId - BigInt(i);
      if (targetAggRound <= 0n) break;
      const targetRoundId = (phaseIdBig << 64n) | targetAggRound;
      try {
        const r = await client.readContract({
          address: f.address,
          abi: PROXY_ABI,
          functionName: "getRoundData",
          args: [targetRoundId],
        });
        rounds.push(r);
      } catch (err) {
        break;
      }
    }

    for (let i = 0; i < rounds.length; i++) {
      const r = rounds[i];
      const p = (Number(r[1]) / 10 ** dec).toFixed(2);
      const dateStr = new Date(Number(r[3]) * 1000).toISOString();
      let deltaStr = "—";
      if (i < rounds.length - 1) {
        const prev = rounds[i + 1];
        const diffSec = Number(r[3]) - Number(prev[3]);
        const diffHours = (diffSec / 3600).toFixed(1);
        deltaStr = `${diffSec}s (${diffHours}h)`;
      }
      console.log(`  #${i.toString().padStart(2, "0")} | ${r[0]} | $${p.padStart(7, " ")} | ${dateStr} | ${deltaStr}`);
    }
  } catch (err) {
    console.error(`Error querying ${f.symbol}:`, err.message || err);
  }
}

async function main() {
  for (const f of FEEDS) {
    await checkFeed(f);
  }
}

main().catch(console.error);
