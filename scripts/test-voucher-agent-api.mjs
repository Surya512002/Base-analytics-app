#!/usr/bin/env node
/**
 * Smoke-test Base Voucher agent API before base/skills PR.
 * Usage: node scripts/test-voucher-agent-api.mjs [baseUrl]
 * Default: http://localhost:3000
 */
const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");

const tests = [];

function ok(name, pass, detail = "") {
  tests.push({ name, pass, detail });
  const icon = pass ? "✓" : "✗";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text: text.slice(0, 120) };
}

async function main() {
  console.log(`\nBase Voucher agent API smoke test\nBase URL: ${BASE}\n`);

  // 1. prepare-create valid
  const create = await get(
    "/api/voucher/prepare-create?asset=USDC&total=10&cards=5&message=SmokeTest"
  );
  ok(
    "prepare-create returns 200",
    create.status === 200,
    `status ${create.status}${create.status === 404 ? " (deploy app first?)" : ""}`
  );
  if (create.json) {
    ok("prepare-create valid:true", create.json.valid === true);
    ok("prepare-create has calls[]", Array.isArray(create.json.calls) && create.json.calls.length >= 1);
    ok(
      "prepare-create USDC has approve+c create",
      create.json.calls?.length >= 2,
      `${create.json.calls?.length ?? 0} calls`
    );
    ok(
      "prepare-create has cards with secrets",
      Array.isArray(create.json.cards) &&
        create.json.cards.length === 5 &&
        create.json.cards[0]?.secret?.includes("-"),
      `${create.json.cards?.length ?? 0} cards`
    );
    ok(
      "calls have to/data/value",
      create.json.calls?.every((c) => c.to && c.data && c.value !== undefined)
    );
    ok("chain is base", create.json.chain === "base");
    ok("contract set", Boolean(create.json.contract));
  } else {
    ok("prepare-create JSON body", false, create.text);
  }

  // 2. prepare-create invalid split
  const badSplit = await get("/api/voucher/prepare-create?asset=USDC&total=10&cards=3");
  ok("invalid split returns valid:false", badSplit.json?.valid === false);
  ok("invalid split has error", Boolean(badSplit.json?.error));

  // 3. prepare-create missing param
  const missing = await get("/api/voucher/prepare-create?asset=USDC&cards=5");
  ok("missing total returns 400", missing.status === 400);

  // 4. prepare-redeem missing params
  const redeemMissing = await get("/api/voucher/prepare-redeem?cardId=1-0");
  ok("redeem missing secret returns 400", redeemMissing.status === 400);

  // 5. prepare-redeem with params (may fail onchain — still proves route works)
  const redeem = await get(
    "/api/voucher/prepare-redeem?cardId=1-0&secret=ABCDE-FGHIJ-KLMNO-PQRST"
  );
  ok(
    "prepare-redeem route responds",
    redeem.status === 200 || redeem.status === 400,
    `status ${redeem.status}`
  );
  ok("prepare-redeem returns JSON protocol", redeem.json?.protocol === "Base Voucher");

  // 6. batch lookup
  const lookup = await get("/api/vouchers?batchId=1");
  ok("vouchers lookup returns 200", lookup.status === 200);
  ok("vouchers lookup has batch key", lookup.json && "batch" in lookup.json);

  const passed = tests.filter((t) => t.pass).length;
  const failed = tests.filter((t) => !t.pass).length;
  console.log(`\n${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log("Fix failures before opening the base/skills PR.");
    if (create.status === 404) {
      console.log("\nTip: Production 404 means agent routes are not deployed yet.");
      console.log("  1. git push → Vercel redeploy");
      console.log("  2. Re-run: node scripts/test-voucher-agent-api.mjs https://base-analytics-app.vercel.app");
    }
    process.exit(1);
  }

  console.log("API layer looks good. Next: deploy + optional Base MCP live test (see README below).\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
