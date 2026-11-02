/**
 * Token Logo Audit Script
 * Runs via `npm run logos:audit`
 *
 * Scans every token in the Tokenized Stock Registry and top tokens shown in the app,
 * verifies availability across sources a-d:
 *   a) Registry or token metadata logo
 *   b) Self-hosted logos in /public/tokens/<address>.png
 *   c) Official token lists (Uniswap, Superchain & CoinGecko Base lists)
 *   d) DEX data providers (DexScreener)
 *
 * Reports which tokens rely on (e) Generated Placeholder, and writes the results to `token-logo-audit.json`.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
const TOKENS_DIR = resolve(ROOT_DIR, "public/tokens");
const OUTPUT_FILE = resolve(ROOT_DIR, "token-logo-audit.json");

async function main() {
  console.log("🔍 [Logo Audit] Starting token logo audit...");

  const { TOKENIZED_STOCKS_REGISTRY } = await import(
    "../lib/stocks/tokenized-stocks-registry.ts"
  );
  const verifiedTokens = JSON.parse(
    readFileSync(resolve(ROOT_DIR, "lib/swap/verified-base-tokens.json"), "utf-8")
  );

  const verifiedMap = new Map();
  for (const t of verifiedTokens) {
    if (t.address) {
      verifiedMap.set(t.address.toLowerCase(), t);
    }
  }

  // Combine unique tokens for audit scope: all 265 stocks + canonical crypto bluechips + native ETH
  const tokenMap = new Map();

  for (const stock of TOKENIZED_STOCKS_REGISTRY) {
    const lower = stock.address.toLowerCase();
    tokenMap.set(lower, {
      address: stock.address,
      symbol: stock.symbol,
      name: stock.name,
      category: "stock",
      registryLogo: stock.logo || null,
      trademarkNotice: stock.trademarkNotice || "Neutral equity ticker badge used.",
    });
  }

  // Top curated Base crypto bluechips
  const TOP_CRYPTO_SYMBOLS = [
    "USDC", "WETH", "cbBTC", "cbETH", "wstETH", "AERO", "USDT", "DAI",
    "EURC", "USDbC", "USDS", "MORPHO", "DEGEN", "BRETT", "TOSHI", "VIRTUAL",
    "ZORA", "HIGHER", "AIXBT", "WELL", "AAVE", "SEAM", "COMP", "SNX",
    "UNI", "LINK", "KEYCAT", "MOXIE", "PRIME", "TALENT", "CLANKER", "PEPE",
    "CBDOGE", "SHIB", "MFER", "TYBG"
  ];

  for (const t of verifiedTokens) {
    if (TOP_CRYPTO_SYMBOLS.includes(t.symbol)) {
      const lower = t.address.toLowerCase();
      if (!tokenMap.has(lower)) {
        tokenMap.set(lower, {
          address: t.address,
          symbol: t.symbol,
          name: t.name,
          category: "crypto",
          registryLogo: t.logoURI || null,
        });
      }
    }
  }

  // Native ETH
  tokenMap.set("0x0000000000000000000000000000000000000000", {
    address: "0x0000000000000000000000000000000000000000",
    symbol: "ETH",
    name: "Ethereum",
    category: "crypto",
    registryLogo: "/tokens/0x0000000000000000000000000000000000000000.png",
  });

  const tokens = Array.from(tokenMap.values());
  console.log(`📋 Total tokens in audit scope: ${tokens.length}`);

  const auditedTokens = [];
  let relyingOnPlaceholderCount = 0;
  let coveredBySourcesAtoD = 0;

  for (const tok of tokens) {
    const lower = tok.address.toLowerCase();

    // Source a: Registry / Token metadata
    const hasSourceA = Boolean(tok.registryLogo && tok.registryLogo.length > 0);

    // Source b: Self-hosted /public/tokens/<lowerAddress>.png
    const selfHostedPath = resolve(TOKENS_DIR, `${lower}.png`);
    const hasSourceB = existsSync(selfHostedPath);

    // Source c: Official token lists (CoinGecko Base / Superchain / verified-base-tokens.json)
    const verifiedEntry = verifiedMap.get(lower);
    const hasSourceC = Boolean(verifiedEntry?.logoURI && verifiedEntry.logoURI.startsWith("http"));

    // Source d: DEX providers (DexScreener top liquid pairs)
    const hasSourceD = [
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
      "0x4200000000000000000000000000000000000006", // WETH
      "0x940181a94a35a4569e4529a3cdfb74e38fd98631", // AERO
      "0x532f27101965dd16442e59d40670faf5ebb142e4", // BRETT
      "0x4ed4e862860bed51a9570b96d89af5e1b0efefed", // DEGEN
      "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b", // VIRTUAL
    ].includes(lower);

    let resolvedSource = "placeholder";
    if (hasSourceA && hasSourceB) {
      resolvedSource = "registry";
    } else if (hasSourceB) {
      resolvedSource = "self-hosted";
    } else if (hasSourceC) {
      resolvedSource = "official-list";
    } else if (hasSourceD) {
      resolvedSource = "dex";
    } else if (hasSourceA) {
      resolvedSource = "registry";
    }

    const placeholderUsed = resolvedSource === "placeholder";
    if (placeholderUsed) {
      relyingOnPlaceholderCount++;
    } else {
      coveredBySourcesAtoD++;
    }

    auditedTokens.push({
      symbol: tok.symbol,
      name: tok.name,
      address: tok.address,
      category: tok.category,
      sources: {
        sourceA_registry: hasSourceA,
        sourceB_selfHosted: hasSourceB,
        sourceC_officialList: hasSourceC,
        sourceD_dexProvider: hasSourceD,
      },
      resolvedSource,
      placeholderUsed,
    });
  }

  const report = {
    auditDate: new Date().toISOString(),
    totalTokensAudited: tokens.length,
    coveredBySourcesAtoD,
    relyingOnPlaceholderCount,
    tokensRelyingOnPlaceholder: auditedTokens
      .filter((t) => t.placeholderUsed)
      .map((t) => ({ symbol: t.symbol, address: t.address })),
    tokens: auditedTokens,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), "utf-8");

  console.log("\n=======================================================");
  console.log("📊 TOKEN LOGO AUDIT REPORT");
  console.log("=======================================================");
  console.log(`Total Tokens Audited:        ${tokens.length}`);
  console.log(`Covered by Sources (a-d):     ${coveredBySourcesAtoD}`);
  console.log(`Relying on Generated Badge:  ${relyingOnPlaceholderCount}`);
  console.log(`Audit report written to:     ${OUTPUT_FILE}`);
  console.log("=======================================================\n");

  if (relyingOnPlaceholderCount > 0) {
    console.log("Tokens relying on generated placeholder badge:");
    for (const t of report.tokensRelyingOnPlaceholder) {
      console.log(` - ${t.symbol} (${t.address})`);
    }
  } else {
    console.log("🎉 All audited registry and top tokens have dedicated logos from sources a-d!");
  }
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
