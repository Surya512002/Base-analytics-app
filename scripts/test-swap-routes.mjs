#!/usr/bin/env node
/**
 * Smoke-test swap quote routes (direct DEX + 0x aggregator).
 *
 * Usage:
 *   npm run test:swap-routes
 *   NEXT_PUBLIC_APP_URL=https://base-analytics-app.vercel.app npm run test:swap-routes
 *
 * Loads NEXT_PUBLIC_APP_URL and ZEROX_API_KEY from .env.local when present.
 * Requires the app running locally (npm run dev) OR a deployed URL — not the
 * placeholder https://your-app.vercel.app
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

function loadEnvFile(name) {
  const path = resolve(root, name);
  if (!existsSync(path)) return;
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const PLACEHOLDER_HOSTS = ["your-app.vercel.app", "example.com"];
const DEFAULT_PROD = "https://base-analytics-app.vercel.app";
const USE_LOCAL = process.argv.includes("--local");

function resolveBaseUrl() {
  if (process.env.SWAP_ROUTES_URL?.trim()) {
    return process.env.SWAP_ROUTES_URL.trim().replace(/\/$/, "");
  }
  if (USE_LOCAL) {
    return "http://localhost:3000";
  }
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv && !fromEnv.includes("localhost") && !fromEnv.includes("127.0.0.1")) {
    const host = new URL(fromEnv).hostname;
    if (!PLACEHOLDER_HOSTS.some((h) => host.includes(h))) {
      return fromEnv.replace(/\/$/, "");
    }
  }
  return DEFAULT_PROD.replace(/\/$/, "");
}

const BASE = resolveBaseUrl();

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
/** Brett on Base — liquid on multiple DEXes. */
const SAMPLE_TOKEN = "0x532f27101965dd16442E59d40670FaF5Ebb142E4";

const CASES = [
  {
    name: "ETH → token (auto)",
    params: {
      token: SAMPLE_TOKEN,
      direction: "buy",
      amount: "0.001",
      decimals: "18",
      slippageBps: "100",
      dex: "auto",
      payAsset: "eth",
      includeAggregator: "1",
    },
  },
  {
    name: "USDC → token (aggregator)",
    params: {
      token: SAMPLE_TOKEN,
      direction: "buy",
      amount: "5",
      decimals: "18",
      slippageBps: "100",
      dex: "auto",
      payAsset: "usdc",
      includeAggregator: "1",
    },
  },
  {
    name: "Token → USDC (aggregator sell)",
    params: {
      token: SAMPLE_TOKEN,
      direction: "sell",
      amount: "1000",
      decimals: "18",
      slippageBps: "100",
      dex: "auto",
      receiveAsset: "usdc",
      includeAggregator: "1",
    },
  },
  {
    name: "Slipstream direct",
    params: {
      token: SAMPLE_TOKEN,
      direction: "buy",
      amount: "0.001",
      decimals: "18",
      slippageBps: "100",
      dex: "slipstream",
      payAsset: "eth",
    },
  },
  {
    name: "Token → token (0x)",
    params: {
      token: SAMPLE_TOKEN,
      direction: "sell",
      amount: "500",
      decimals: "18",
      slippageBps: "100",
      dex: "auto",
      receiveAsset: "token",
      receiveToken: USDC,
      includeAggregator: "1",
    },
  },
];

async function preflight() {
  const url = `${BASE}/api/launchpad/status`;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${url}`);
    }
    if (!ct.includes("application/json")) {
      const snippet = (await res.text()).slice(0, 80);
      throw new Error(
        `Expected JSON from API but got HTML/text. Is ${BASE} your deployed app?\n  ${snippet}…`
      );
    }
    return true;
  } catch (e) {
    if (BASE.includes("localhost")) {
      throw new Error(
        `Cannot reach ${BASE} — start the dev server first:\n  npm run dev\n\n` +
          `Or test production:\n  NEXT_PUBLIC_APP_URL=${DEFAULT_PROD} npm run test:swap-routes\n\n` +
          `Original: ${e instanceof Error ? e.message : e}`
      );
    }
    throw e;
  }
}

async function runCase(testCase) {
  const qs = new URLSearchParams(testCase.params);
  const url = `${BASE}/api/launchpad/quote?${qs}`;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const snippet = (await res.text()).slice(0, 60);
      console.log("✗", testCase.name, "| non-JSON response:", snippet);
      return false;
    }
    const data = await res.json();
    const ok = Boolean(data.hasLiquidity);
    console.log(
      ok ? "✓" : "✗",
      testCase.name,
      "| dex:",
      data.dex ?? "—",
      "| out:",
      data.amountOut ?? "0",
      data.error ? `| ${data.error}` : ""
    );
    if (data.aggregatorHasLiquidity) {
      console.log("  ↳ aggregator alt:", data.aggregatorAmountOut);
    }
    if (!ok && data.aggregatorConfigured === false) {
      console.log("  ↳ hint: set ZEROX_API_KEY on server for USDC/token routes");
    }
    return ok;
  } catch (e) {
    console.log("✗", testCase.name, "| fetch failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

async function main() {
  console.log(`Testing swap quotes against ${BASE}\n`);

  try {
    await preflight();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  if (!process.env.ZEROX_API_KEY) {
    console.log(
      "Note: ZEROX_API_KEY not loaded locally — USDC/token→token cases need it on the server (Vercel env).\n"
    );
  }

  let passed = 0;
  for (const c of CASES) {
    if (await runCase(c)) passed += 1;
  }
  console.log(`\n${passed}/${CASES.length} routes returned liquidity.`);
  process.exit(passed > 0 ? 0 : 1);
}

void main();
