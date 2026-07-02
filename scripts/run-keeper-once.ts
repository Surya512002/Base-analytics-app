#!/usr/bin/env npx tsx
/**
 * One-shot keeper: open / close / resolve all prediction markets on Base.
 * Usage: npx tsx scripts/run-keeper-once.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import { runPredictionKeeper } from "../lib/predictions/keeper";

function loadEnvLocal() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i);
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    // optional
  }
}

async function main() {
  loadEnvLocal();

  const contract = process.env.NEXT_PUBLIC_PREDICTIONS_CONTRACT as `0x${string}`;
  const key = process.env.PREDICTIONS_KEEPER_PRIVATE_KEY as `0x${string}`;
  const alchemy = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
  const rpc =
    process.env.BASE_RPC_URL ||
    (alchemy ? `https://base-mainnet.g.alchemy.com/v2/${alchemy}` : "");

  if (!contract || !key || !rpc) {
    console.error("Missing NEXT_PUBLIC_PREDICTIONS_CONTRACT, keeper key, or RPC");
    process.exit(1);
  }

  console.log("Running keeper on", contract);
  const result = await runPredictionKeeper({
    rpcUrl: rpc,
    contract,
    privateKey: key,
    initialLiquidityUsdc: Number(
      process.env.PREDICTIONS_INITIAL_LIQUIDITY_USDC || "10000"
    ),
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
