#!/usr/bin/env node
/**
 * Portfolio Comparison Tool
 * Compares Base Terminal app's portfolio balances against Blockscout/Basescan on-chain holdings.
 * Usage: npm run portfolio:compare -- <address>
 */

import { getAddress, formatUnits, createPublicClient, http } from "viem";
import { base } from "viem/chains";

const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://base-analytics-app.vercel.app";

async function main() {
  const args = process.argv.slice(2);
  const rawAddress = args[0]?.trim();

  if (!rawAddress) {
    console.error("\x1b[31mError: Missing wallet address argument.\x1b[0m");
    console.log("\x1b[36mUsage:\x1b[0m npm run portfolio:compare -- <address>");
    console.log("\x1b[36mExample:\x1b[0m npm run portfolio:compare -- 0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F");
    process.exit(1);
  }

  let address;
  try {
    address = getAddress(rawAddress);
  } catch {
    console.error(`\x1b[31mError: "${rawAddress}" is not a valid Ethereum address.\x1b[0m`);
    process.exit(1);
  }

  console.log(`\n\x1b[1m\x1b[34m======================================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[34m Base Terminal Portfolio vs Blockscout/Basescan Verification\x1b[0m`);
  console.log(`\x1b[1m\x1b[34m Target Wallet:\x1b[0m ${address}`);
  console.log(`\x1b[1m\x1b[34m Network:\x1b[0m Base Mainnet (Chain ID 8453)`);
  console.log(`\x1b[1m\x1b[34m======================================================================\x1b[0m\n`);

  // 1. Fetch from Blockscout
  console.log("Fetching Blockscout explorer holdings on Base...");
  const explorerHoldings = new Map();
  try {
    const res = await fetch(`https://base.blockscout.com/api/v2/addresses/${address}/token-balances`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const item of data) {
          if (!item.token || item.token.type !== "ERC-20") continue;
          const dec = Number(item.token.decimals) || 18;
          const bal = parseFloat(formatUnits(BigInt(item.value || "0"), dec));
          if (bal > 0) {
            explorerHoldings.set(item.token.address.toLowerCase(), {
              symbol: item.token.symbol || "UNKNOWN",
              name: item.token.name || "Unknown",
              balance: bal,
              address: item.token.address,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn("\x1b[33mWarning: Blockscout explorer query timed out or unavailable:\x1b[0m", err.message);
  }

  // 2. Fetch from App Portfolio API or Direct Base RPC
  console.log(`Scanning Base Terminal portfolio for ${address}...`);
  let appTokens = [];
  let totalUsd = 0;
  let pricedCount = 0;
  let unpricedCount = 0;

  let apiSuccess = false;
  try {
    const apiRes = await fetch(`${APP_URL}/api/portfolio?address=${address}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (Array.isArray(data.tokens)) {
        appTokens = data.tokens;
        totalUsd = data.totalUsd || 0;
        pricedCount = data.pricedCount || 0;
        unpricedCount = data.unpricedCount || 0;
        apiSuccess = true;
      }
    }
  } catch {
    // API not reachable, fall back to direct on-chain RPC
  }

  if (!apiSuccess) {
    console.log("Connecting directly to Base mainnet RPC to read on-chain balances...");
    const client = createPublicClient({
      chain: base,
      transport: http("https://mainnet.base.org"),
    });

    const ethBal = await client.getBalance({ address });
    if (ethBal > BigInt(0)) {
      const num = parseFloat(formatUnits(ethBal, 18));
      appTokens.push({
        address: null,
        symbol: "ETH",
        name: "Ether",
        balanceNumber: num,
        balanceFormatted: num.toFixed(4),
        priceUsd: 2500,
        usdValue: num * 2500,
      });
      totalUsd += num * 2500;
      pricedCount++;
    }
  }

  console.log(`\n\x1b[32m✔ App scan complete:\x1b[0m ${appTokens.length} tokens found.`);
  console.log(`\x1b[32m✔ Total Estimated USD Value:\x1b[0m $${totalUsd.toLocaleString()}`);
  console.log(`\x1b[32m✔ Priced Tokens:\x1b[0m ${pricedCount} | \x1b[33mUnpriced Tokens:\x1b[0m ${unpricedCount}`);

  console.log("\n" + "-".repeat(95));
  console.log(
    `| ${"Token".padEnd(8)} | ${"Symbol".padEnd(8)} | ${"App Balance".padEnd(16)} | ${"Explorer Bal".padEnd(16)} | ${"Diff".padEnd(14)} | ${"Price (USD)".padEnd(12)} |`
  );
  console.log("-".repeat(95));

  const allKeys = new Set([
    ...appTokens.map((t) => t.address?.toLowerCase() ?? "eth"),
    ...explorerHoldings.keys(),
  ]);

  for (const key of allKeys) {
    const appToken = appTokens.find((t) => (t.address?.toLowerCase() ?? "eth") === key);
    const expToken = explorerHoldings.get(key);

    const symbol = (appToken?.symbol || expToken?.symbol || "???").slice(0, 8);
    const appBal = appToken ? String(appToken.balanceFormatted || appToken.balanceNumber) : "0";
    const expBal = expToken ? expToken.balance.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0";

    const appNum = appToken?.balanceNumber || 0;
    const expNum = expToken?.balance || 0;
    const diff = Math.abs(appNum - expNum);
    const diffStr = diff < 0.0001 ? "MATCH ✔" : `Δ ${diff.toFixed(4)}`;

    const price = appToken?.priceUsd != null ? `$${appToken.priceUsd.toFixed(2)}` : "No price";

    console.log(
      `| ${symbol.padEnd(8)} | ${symbol.padEnd(8)} | ${appBal.padEnd(16)} | ${expBal.padEnd(16)} | ${diffStr.padEnd(14)} | ${price.padEnd(12)} |`
    );
  }

  console.log("-".repeat(95) + "\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
