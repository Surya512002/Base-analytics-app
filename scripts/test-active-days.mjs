#!/usr/bin/env node
/** Smoke test active days for a Base App smart wallet. */
import { fetchBlockscoutV2Activity } from "../lib/api/blockscout-v2.ts";
import { rollupWalletActivity } from "../lib/utils/wallet-activity.ts";

const addr = process.argv[2] || "0x6b444856ee67fc9872c59d35ff8a8f744af717f2";
const t0 = Date.now();
const txs = await fetchBlockscoutV2Activity(addr);
const activity = rollupWalletActivity(txs, addr);
console.log({
  addr,
  legs: txs.length,
  uniqueDays: activity.uDays.size,
  txCount: activity.participatingHashes.size,
  seconds: ((Date.now() - t0) / 1000).toFixed(1),
});
