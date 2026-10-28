import { createPublicClient, http, getAddress, parseUnits, parseEther } from "viem";
import { base } from "viem/chains";
import { writeFileSync } from "node:fs";
import { TOKENIZED_STOCKS_REGISTRY } from "../lib/stocks/tokenized-stocks-registry.ts";

const RPC_URL = process.env.BASE_RPC_URL || process.env.ANVIL_RPC_URL || "https://mainnet.base.org";

const client = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";

// Factories
const UNI_V3_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
const AERO_FACTORY = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da";
const SLIPSTREAM_FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";

const UNI_V3_FACTORY_ABI = [
  {
    name: "getPool",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
];

const AERO_FACTORY_ABI = [
  {
    name: "getPool",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "stable", type: "bool" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
];

const SLIPSTREAM_FACTORY_ABI = [
  {
    name: "getPool",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "tickSpacing", type: "int24" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
];

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
];

async function scanStock(stock) {
  const pools = [];
  const targets = [
    { name: "USDC", address: USDC },
    { name: "WETH", address: WETH },
  ];

  for (const quoteToken of targets) {
    // 1. Uniswap V3 fees 100, 500, 3000, 10000
    for (const fee of [100, 500, 3000, 10000]) {
      try {
        const pool = await client.readContract({
          address: UNI_V3_FACTORY,
          abi: UNI_V3_FACTORY_ABI,
          functionName: "getPool",
          args: [stock.address, quoteToken.address, fee],
        });
        if (pool && pool !== "0x0000000000000000000000000000000000000000") {
          const stockBal = await client.readContract({
            address: stock.address,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [pool],
          }).catch(() => BigInt(0));
          const quoteBal = await client.readContract({
            address: quoteToken.address,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [pool],
          }).catch(() => BigInt(0));
          pools.push({
            venue: "Uniswap V3",
            pair: `${stock.symbol}/${quoteToken.name}`,
            feeTier: fee,
            pool,
            stockBal: stockBal.toString(),
            quoteBal: quoteBal.toString(),
          });
        }
      } catch (e) {}
    }

    // 2. Aerodrome V2 (volatile false, stable true)
    for (const stable of [false, true]) {
      try {
        const pool = await client.readContract({
          address: AERO_FACTORY,
          abi: AERO_FACTORY_ABI,
          functionName: "getPool",
          args: [stock.address, quoteToken.address, stable],
        });
        if (pool && pool !== "0x0000000000000000000000000000000000000000") {
          const stockBal = await client.readContract({
            address: stock.address,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [pool],
          }).catch(() => BigInt(0));
          const quoteBal = await client.readContract({
            address: quoteToken.address,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [pool],
          }).catch(() => BigInt(0));
          pools.push({
            venue: "Aerodrome V2",
            pair: `${stock.symbol}/${quoteToken.name}`,
            poolType: stable ? "stable" : "volatile",
            pool,
            stockBal: stockBal.toString(),
            quoteBal: quoteBal.toString(),
          });
        }
      } catch (e) {}
    }

    // 3. Slipstream
    for (const tickSpacing of [1, 50, 100, 200, 2000]) {
      try {
        const pool = await client.readContract({
          address: SLIPSTREAM_FACTORY,
          abi: SLIPSTREAM_FACTORY_ABI,
          functionName: "getPool",
          args: [stock.address, quoteToken.address, tickSpacing],
        });
        if (pool && pool !== "0x0000000000000000000000000000000000000000") {
          const stockBal = await client.readContract({
            address: stock.address,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [pool],
          }).catch(() => BigInt(0));
          const quoteBal = await client.readContract({
            address: quoteToken.address,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [pool],
          }).catch(() => BigInt(0));
          pools.push({
            venue: "Aerodrome Slipstream",
            pair: `${stock.symbol}/${quoteToken.name}`,
            tickSpacing,
            pool,
            stockBal: stockBal.toString(),
            quoteBal: quoteBal.toString(),
          });
        }
      } catch (e) {}
    }
  }

  return {
    symbol: stock.symbol,
    name: stock.name,
    address: stock.address,
    pools,
  };
}

async function main() {
  console.log("Scanning all 32 stocks on Base mainnet...");
  const results = [];
  for (const stock of TOKENIZED_STOCKS_REGISTRY) {
    const res = await scanStock(stock);
    results.push(res);
    console.log(`[${res.symbol}] Found ${res.pools.length} pools:`, res.pools.map(p => `${p.venue} (${p.pair}${p.feeTier ? ' fee:' + p.feeTier : ''})`));
  }

  writeFileSync("scripts/pools-scan-results.json", JSON.stringify(results, null, 2));
  console.log("Results written to scripts/pools-scan-results.json");
}

main().catch(console.error);
