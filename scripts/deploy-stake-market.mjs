#!/usr/bin/env node
/**
 * Deploy XpStake and BadgeMarketplace to Base mainnet.
 *
 * Usage:
 *   PRIVATE_KEY=0x... node scripts/deploy-stake-market.mjs
 *
 * Then add to .env.local:
 *   NEXT_PUBLIC_XP_STAKE_CONTRACT=0x...
 *   NEXT_PUBLIC_BADGE_MARKETPLACE_CONTRACT=0x...
 */
import { createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const pk = process.env.PRIVATE_KEY;
if (!pk) {
  console.error("Set PRIVATE_KEY");
  process.exit(1);
}

const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const client = createWalletClient({ account, chain: base, transport: http() });

function compile(name) {
  const path = resolve(root, "contracts", `${name}.sol`);
  const out = resolve(root, "artifacts", name);
  execSync(
    `solc --bin --abi --optimize --base-path ${root} -o ${out} ${path}`,
    { stdio: "inherit" }
  );
  const abi = JSON.parse(readFileSync(resolve(out, `${name}.abi`), "utf8"));
  const bytecode = `0x${readFileSync(resolve(out, `${name}.bin`), "utf8").trim()}`;
  return { abi, bytecode };
}

async function deploy(name, args = []) {
  const { abi, bytecode } = compile(name);
  const hash = await client.deployContract({
    abi,
    bytecode,
    args,
    account,
  });
  console.log(`${name} tx:`, hash);
  return hash;
}

const ACHIEVEMENTS = "0xadb8120B4B18b892cFAD171243074487122Dea03";

console.log("Deploying XpStake...");
await deploy("XpStake");
console.log("Deploying BadgeMarketplace...");
await deploy("BadgeMarketplace", [ACHIEVEMENTS]);
console.log("Done — verify addresses on basescan and set env vars.");
