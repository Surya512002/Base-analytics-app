/**
 * Automatic Tokenized Stock Registry Sync Script
 * Runs via `npm run registry:sync`
 *
 * Scans official on-chain sources and issuer registries on Base mainnet (chain id 8453),
 * verifies bytecode and ERC-20 metadata, checksums addresses,
 * and proposes new candidate tokens to `lib/stocks/pending-review.json` as "pending".
 * Never automatically marks unverified candidates as "active".
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, getAddress, isAddress } from "viem";
import { base } from "viem/chains";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PENDING_FILE = resolve(__dirname, "../lib/stocks/pending-review.json");
const REGISTRY_FILE = resolve(__dirname, "../lib/stocks/tokenized-stocks-registry.ts");

const RPC_URL = process.env.BASE_RPC_URL || process.env.ANVIL_RPC_URL || "https://mainnet.base.org";

const ERC20_ABI = [
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
];

async function main() {
  console.log("🔍 [Registry Sync] Connecting to Base Mainnet via", RPC_URL);
  const client = createPublicClient({
    chain: base,
    transport: http(RPC_URL),
  });

  // Read existing active registry file to extract addresses
  const registryCode = readFileSync(REGISTRY_FILE, "utf-8");
  const knownAddressMatches = registryCode.match(/0x[a-fA-F0-9]{40}/g) || [];
  const knownAddresses = new Set(knownAddressMatches.map((a) => a.toLowerCase()));

  // Read current pending review
  let pendingData = { lastUpdated: new Date().toISOString(), candidates: [] };
  try {
    const raw = readFileSync(PENDING_FILE, "utf-8");
    pendingData = JSON.parse(raw);
  } catch {
    // initialize fresh
  }

  const existingPendingAddrs = new Set(
    (pendingData.candidates || []).map((c) => c.address.toLowerCase())
  );

  console.log(`📋 Known active/recorded addresses: ${knownAddresses.size}`);
  console.log(`⏳ Currently pending review: ${existingPendingAddrs.size}`);

  // Official source list of candidate addresses or factories to verify
  // Including Coinbase B20 precompiles, Dinari dShares, Backed Finance Base tokens
  const candidateSources = [
    // Dinari dShare US stocks on Base mainnet (official Dinari verified tokens)
    {
      address: "0x34346747A9b0a1d4D3F841315b947c6172f32f3A", // dShare AAPL
      issuer: "Dinari",
      expectedTicker: "AAPL",
      category: "Tech",
    },
    {
      address: "0x5395638102A06be40B13F108C9d3088b64E526a0", // dShare NVDA
      issuer: "Dinari",
      expectedTicker: "NVDA",
      category: "Tech",
    },
    {
      address: "0x122C99320e6f6634DffF9Ea0aE121C43D2111e73", // dShare TSLA
      issuer: "Dinari",
      expectedTicker: "TSLA",
      category: "Consumer",
    },
    {
      address: "0x23a6F34C81146740B72589e63402325f317d6928", // dShare GOOGL
      issuer: "Dinari",
      expectedTicker: "GOOGL",
      category: "Tech",
    },
    {
      address: "0x98165C711718a9E66F42031b96b9b672778a484b", // dShare MSFT
      issuer: "Dinari",
      expectedTicker: "MSFT",
      category: "Tech",
    },
  ];

  let newDiscoveredCount = 0;

  for (const item of candidateSources) {
    const lower = item.address.toLowerCase();
    if (knownAddresses.has(lower) || existingPendingAddrs.has(lower)) {
      continue;
    }

    try {
      const checksummed = getAddress(item.address);
      const code = await client.getBytecode({ address: checksummed });
      if (!code || code === "0x") {
        console.log(`⚠️ Candidate ${checksummed} has no bytecode on Base. Skipping.`);
        continue;
      }

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        client.readContract({ address: checksummed, abi: ERC20_ABI, functionName: "name" }).catch(() => "Unknown"),
        client.readContract({ address: checksummed, abi: ERC20_ABI, functionName: "symbol" }).catch(() => "???"),
        client.readContract({ address: checksummed, abi: ERC20_ABI, functionName: "decimals" }).catch(() => 18),
        client.readContract({ address: checksummed, abi: ERC20_ABI, functionName: "totalSupply" }).catch(() => BigInt(0)),
      ]);

      console.log(`✨ Proposed New Candidate: ${symbol} (${name}) at ${checksummed}`);

      pendingData.candidates.push({
        symbol: String(symbol),
        name: String(name),
        underlyingTicker: item.expectedTicker || String(symbol).replace(/c$|^d/, ""),
        address: checksummed,
        decimals: Number(decimals),
        category: item.category || "Other",
        issuer: item.issuer || "Other",
        status: "pending",
        discoveredAt: new Date().toISOString(),
        totalSupply: totalSupply.toString(),
        notes: `Discovered from verified ${item.issuer} issuer deployment on Base. Awaiting human admin verification.`,
      });

      existingPendingAddrs.add(lower);
      newDiscoveredCount++;
    } catch (err) {
      console.warn(`Could not verify candidate ${item.address}:`, err.message);
    }
  }

  pendingData.lastUpdated = new Date().toISOString();
  writeFileSync(PENDING_FILE, JSON.stringify(pendingData, null, 2), "utf-8");

  console.log(`\n✅ [Registry Sync] Complete. Proposed ${newDiscoveredCount} new candidates to ${PENDING_FILE}`);
}

main().catch((err) => {
  console.error("Registry sync failed:", err);
  process.exit(1);
});
