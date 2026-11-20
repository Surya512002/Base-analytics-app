#!/usr/bin/env node
/**
 * Mainnet preflight for Drops. Run it right after deploying and again after setting env vars:
 *
 *   node scripts/drops-preflight.mjs --drops 0x… --gate 0x… [--rpc https://mainnet.base.org] [--app https://baseanalytics.app]
 *
 * Add --chain 84532 to rehearse the same checks on Base Sepolia.
 *
 * It proves the contracts on chain are exactly the ones in this repo (same runtime bytecode,
 * ignoring the compiler's metadata tail), that the creator-facing constants look right, and
 * (with --app) that the live deployment reports every setup check green. Reads only, sends nothing.
 */
import { readFileSync } from "node:fs";
import { createPublicClient, http, isAddress } from "viem";
import { base, baseSepolia } from "viem/chains";

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const drops = arg("drops");
const gate = arg("gate");
const chainArg = Number(arg("chain", "8453"));
const chain = chainArg === 84532 ? baseSepolia : base;
const rpc = arg("rpc", chain.rpcUrls.default.http[0]);
const app = arg("app");
if (!isAddress(drops ?? "") || !isAddress(gate ?? "")) {
  console.error("Usage: node scripts/drops-preflight.mjs --drops 0x… --gate 0x… [--rpc URL] [--app URL]");
  process.exit(2);
}

const client = createPublicClient({ chain, transport: http(rpc) });
let failed = false;
const report = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failed = true;
};

/** Drop the trailing CBOR metadata (its length is in the last 2 bytes) so builds on other machines still match. */
function stripMetadata(hex) {
  const h = hex.toLowerCase().replace(/^0x/, "");
  const len = parseInt(h.slice(-4), 16) * 2 + 4;
  return Number.isFinite(len) && len < h.length ? h.slice(0, -len) : h;
}
const compiled = (name) => JSON.parse(readFileSync(`forge-out/${name}.sol/${name}.json`, "utf8")).deployedBytecode.object;

const chainId = await client.getChainId();
report(chainId === chain.id, `RPC is ${chain.name} (chain id ${chainId})`);

for (const [name, address] of [["BaseDrops", drops], ["TokenBalanceGate", gate]]) {
  const code = await client.getCode({ address });
  report(Boolean(code && code !== "0x"), `${name} has code at ${address}`);
  if (code && code !== "0x") report(stripMetadata(code) === stripMetadata(compiled(name)), `${name} bytecode matches this repo's build (forge-out)`);
}

const next = await client
  .readContract({
  address: drops,
  abi: [{ type: "function", name: "nextDropId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }],
  functionName: "nextDropId",
})
  .catch(() => null);
report(next === 2000000001n, next === null ? "nextDropId can't be read: this is not a BaseDrops contract" : `No drops created yet (nextDropId = ${next}); a clean launch starts at 2000000001`);

if (app) {
  const res = await fetch(`${app.replace(/\/$/, "")}/api/drops/status`).catch(() => null);
  const body = res ? await res.json().catch(() => null) : null;
  if (!body) report(false, `${app}/api/drops/status didn't answer`);
  else {
    report(body.chainId === chain.id, `App reports chain ${body.chainId}`);
    for (const c of body.checks) report(c.ok, `app: ${c.id}${c.ok ? "" : ` — ${c.note}`}`);
  }
}
console.log(failed ? "\nNOT READY: fix the FAIL lines above." : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
