#!/usr/bin/env node
/** Diagnose swap volume from Blockscout token transfers. */
import { getAddress } from "viem";

const addr = (process.argv[2] || "0xb4bd7d410543cb27f42c562ab3ff5dc12fbdd42f").toLowerCase();
const pathAddr = getAddress(addr);
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const WETH = "0x4200000000000000000000000000000000000006";
const STABLES = new Set([USDC, "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca", WETH]);

const DEX = new Set([
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
  "0x3a23f943181408eac424116af7b7790c94cb97a5",
  "0x2626664c2603336e57b271c5c0b26f421741e481",
  "0x1111111254eeb25477b68fb85ed929f73a960582",
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff",
  "0x19cee0fad0b2f56a4118c2fdda38b04eef1dd7bfd",
]);

async function fetchAllTokens(maxPages = 30) {
  let url = `https://base.blockscout.com/api/v2/addresses/${pathAddr}/token-transfers`;
  const items = [];
  for (let p = 0; p < maxPages; p++) {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.items?.length) break;
    items.push(...data.items);
    if (!data.next_page_params) break;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(data.next_page_params))
      if (v != null) qs.set(k, String(v));
    url = `https://base.blockscout.com/api/v2/addresses/${pathAddr}/token-transfers?${qs}`;
  }
  return items;
}

const tokens = await fetchAllTokens(40);
console.log("token transfer rows:", tokens.length);

const byHash = new Map();
for (const t of tokens) {
  const hash = t.transaction_hash;
  if (!byHash.has(hash)) byHash.set(hash, []);
  byHash.get(hash).push(t);
}

let stableOutToDex = 0;
let swapHashCount = 0;
let stableOutTotal = 0;

for (const [hash, legs] of byHash) {
  let outStable = 0;
  let inStable = 0;
  let hasOut = false;
  let hasIn = false;
  let toDex = false;

  for (const t of legs) {
    const from = (t.from?.hash || "").toLowerCase();
    const to = (t.to?.hash || "").toLowerCase();
    const tokenAddr = (t.token?.address_hash || "").toLowerCase();
    const dec = Number(t.total?.decimals || 6);
    const val = Number(t.total?.value || 0) / 10 ** dec;

    if (from === addr) {
      hasOut = true;
      if (STABLES.has(tokenAddr)) {
        outStable += val;
        stableOutTotal += val;
        if (DEX.has(to)) toDex = true;
      }
    }
    if (to === addr) {
      hasIn = true;
      if (STABLES.has(tokenAddr)) inStable += val;
    }
  }

  if (hasOut && hasIn && (outStable > 0 || inStable > 0)) {
    swapHashCount++;
    stableOutToDex += Math.max(outStable, inStable);
  } else if (toDex && outStable > 0) {
    swapHashCount++;
    stableOutToDex += outStable;
  }
}

console.log({
  swapHashes: swapHashCount,
  stableVolumeUsd: stableOutToDex.toFixed(2),
  stableOutTotal: stableOutTotal.toFixed(2),
  samplePages: 40,
});
