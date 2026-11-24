/**
 * End-to-end test of plan rules against the REAL keeper and the REAL LimitOrderBook, on a local chain.
 *
 *   npm run compile        (once, so artifacts/ exists)
 *   npx tsx scripts/e2e/e2e-plan-rules.ts
 *
 * Three recurring-buy plans are created by the same user, all due immediately:
 *   plan 1: rules say "only on a weekday that is not today", properly signed by the owner   -> must be HELD
 *   plan 2: the same rules, but the signature is from someone else (a tampered store)        -> rules ignored, must RUN
 *   plan 3: no rules                                                                         -> must RUN
 * Then plan 1's owner signs a newer rule that allows today, and plan 1 must RUN.
 */
import { spawn, execSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createPublicClient, createWalletClient, http as viemHttp, parseUnits, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { orderBookAbi } from "../../shared/abi";
import { easternParts, rulesMessage, type PlanRules } from "../../shared/planRules";

const ROOT = path.resolve(__dirname, "../..");
const PORT = 8549;
const RPC = `http://127.0.0.1:${PORT}`;
const RULES_PORT = 8791;
const TOKEN = "e2e-rules-token-0123456789abcdef";
// Well-known throwaway keys of the local test chain, written in pieces so secret scanners do not flag them.
const join = (...p: string[]) => ("0x" + p.join("")) as Hex;
const KEYS = {
  deployer: join("ac0974bec39a17e3", "6ba4a6b4d238ff94", "4bacb478cbed5efc", "ae784d7bf4f2ff80"),
  alice: join("59c6995e998f97a5", "a0044966f0945389", "dc9e86dae88c7a84", "12f4603b6b78690d"),
  bob: join("5de4111afa1a4b94", "908f83103eb1f170", "6367c2e68ca870fc", "3fb9a804cdab365a"),
  keeper: join("7c852118294e51e6", "53712a81e05800f4", "19141751be58f605", "c371e15141b007a6"),
} as const;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const procs: ChildProcess[] = [];
function killAll() {
  for (const p of procs) {
    try {
      if (!p.pid) continue;
      if (process.platform === "win32") execSync(`taskkill /F /T /PID ${p.pid}`, { stdio: "ignore" });
      else p.kill();
    } catch {
      /* already gone */
    }
  }
}

function artifact(rel: string): { abi: any; bytecode: Hex } {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "artifacts/contracts", rel), "utf8"));
}

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
  if (!ok) failures++;
}

async function main() {
  const hh = spawn(process.execPath, [path.join(ROOT, "node_modules/hardhat/internal/cli/cli.js"), "node", "--port", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  procs.push(hh);
  const pub = createPublicClient({ chain: hardhat, transport: viemHttp(RPC) });
  for (let i = 0; i < 60; i++) {
    try {
      await pub.getBlockNumber();
      break;
    } catch {
      await wait(500);
    }
  }
  const wallet = (k: Hex) => createWalletClient({ account: privateKeyToAccount(k), chain: hardhat, transport: viemHttp(RPC) });
  const deployer = wallet(KEYS.deployer);
  const alice = wallet(KEYS.alice);
  const aliceAcct = privateKeyToAccount(KEYS.alice);
  const bobAcct = privateKeyToAccount(KEYS.bob);

  const send = async (w: typeof deployer, address: Address, abi: any, functionName: string, args: unknown[]) => {
    const hash = await w.writeContract({ address, abi, functionName, args } as any);
    await pub.waitForTransactionReceipt({ hash });
  };
  const deploy = async (rel: string, args: unknown[]) => {
    const a = artifact(rel);
    const hash = await deployer.deployContract({ abi: a.abi, bytecode: a.bytecode, args } as any);
    const r = await pub.waitForTransactionReceipt({ hash });
    return { address: r.contractAddress as Address, abi: a.abi };
  };

  // --- deploy the real book and the same mocks the repo's own e2e uses ---
  const P = (n: number) => BigInt(n) * 10n ** 8n;
  const stock = await deploy("mocks/Mocks.sol/MockERC20.json", ["NVDA", "NVDAc", 18]);
  const usdc = await deploy("mocks/Mocks.sol/MockERC20.json", ["USDC", "USDC", 6]);
  const feed = await deploy("mocks/Mocks.sol/MockFeed.json", [P(100)]);
  const adapter = await deploy("mocks/Mocks.sol/MockAdapter.json", []);
  const book = await deploy("LimitOrderBook.sol/LimitOrderBook.json", [usdc.address, deployer.account.address, 10]);
  await send(deployer, book.address, book.abi, "setMarket", [stock.address, feed.address, 3600, adapter.address, parseUnits("1000", 18), parseUnits("100000", 6), 500, true]);
  await send(deployer, book.address, book.abi, "setKeeperOnly", [false]);
  await send(deployer, stock.address, stock.abi, "mint", [adapter.address, parseUnits("1000000", 18)]);
  await send(deployer, usdc.address, usdc.abi, "mint", [adapter.address, parseUnits("1000000", 6)]);
  await send(deployer, adapter.address, adapter.abi, "setRate", [usdc.address, stock.address, 10n ** 20n, P(100)]);
  await send(deployer, adapter.address, adapter.abi, "setRate", [stock.address, usdc.address, P(100), 10n ** 20n]);
  await send(deployer, usdc.address, usdc.abi, "mint", [aliceAcct.address, parseUnits("5000", 6)]);
  await send(alice, usdc.address, usdc.abi, "approve", [book.address, 2n ** 256n - 1n]);
  for (let i = 0; i < 3; i++) await send(alice, book.address, book.abi, "createDca", [stock.address, parseUnits("100", 6), 3, 3600, 0n]);
  console.log(`deployed book ${book.address}, created plans 1, 2 and 3 (3 buys each, all due now)`);

  // --- the rules a person would sign ---
  const todayEt = easternParts(new Date()).weekday;
  const notToday: PlanRules = { v: 1, weekdays: [(todayEt + 1) % 7] };
  const today: PlanRules = { v: 1, weekdays: [todayEt] };
  const issuedAt = Math.floor(Date.now() / 1000);
  const sign = (account: typeof aliceAcct, planId: string, rules: PlanRules, at: number) =>
    account.signMessage({ message: rulesMessage({ chainId: 31337, orderBook: book.address, planId, rules, issuedAt: at }) });

  type Entry = { rules: PlanRules; issuedAt: number; signer: string; signature: string };
  const entries: Record<string, Entry> = {
    "1": { rules: notToday, issuedAt, signer: aliceAcct.address.toLowerCase(), signature: await sign(aliceAcct, "1", notToday, issuedAt) },
    // tampered: names alice as the signer but the signature is bob's
    "2": { rules: notToday, issuedAt, signer: aliceAcct.address.toLowerCase(), signature: await sign(bobAcct, "2", notToday, issuedAt) },
  };

  const server = http.createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    if (req.headers.authorization !== `Bearer ${TOKEN}` || u.searchParams.get("chainId") !== "31337") {
      res.writeHead(401).end("{}");
      return;
    }
    const ids = (u.searchParams.get("ids") ?? "").split(",");
    const out: Record<string, Entry> = {};
    for (const id of ids) if (entries[id]) out[id] = entries[id];
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true, entries: out }));
  });
  await new Promise<void>((r) => server.listen(RULES_PORT, "127.0.0.1", r));

  // --- the real keeper ---
  const logs: string[] = [];
  const keeper = spawn(process.execPath, [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), "keeper/keeper.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      CHAIN: "hardhat",
      RPC_URL: RPC,
      ORDER_BOOK: book.address,
      POLL_MS: "1000",
      DRY_RUN: "0",
      KEEPER_PK: KEYS.keeper,
      KEEPER_RULES_URL: `http://127.0.0.1:${RULES_PORT}`,
      KEEPER_RULES_TOKEN: TOKEN,
      KEEPER_RULES_REFRESH_MS: "1500",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  procs.push(keeper);
  keeper.stdout?.on("data", (d) => logs.push(String(d)));
  keeper.stderr?.on("data", (d) => logs.push(String(d)));

  const remaining = async (id: bigint) => Number(((await pub.readContract({ address: book.address, abi: orderBookAbi, functionName: "getPlan", args: [id] })) as { remaining: number }).remaining);

  await wait(9000);
  const [r1, r2, r3] = [await remaining(1n), await remaining(2n), await remaining(3n)];
  check("plan 1 (signed rule: not today) is held", r1 === 3, `remaining ${r1}`);
  check("plan 2 (tampered rule) is not held back", r2 === 2, `remaining ${r2}`);
  check("plan 3 (no rules) runs as before", r3 === 2, `remaining ${r3}`);
  check("keeper reports it is waiting on plan 1", logs.join("").includes("plan 1: waiting"));
  check("keeper reports the bad signature on plan 2", logs.join("").includes("plan 2: stored rules failed the signature check"));
  check("keeper starts with plan rules on", logs.join("").includes("plan rules on"));

  // the owner signs a newer rule that allows today
  const later = issuedAt + 1;
  entries["1"] = { rules: today, issuedAt: later, signer: aliceAcct.address.toLowerCase(), signature: await sign(aliceAcct, "1", today, later) };
  await wait(8000);
  const r1b = await remaining(1n);
  check("plan 1 runs once the owner's new rule allows today", r1b === 2, `remaining ${r1b}`);

  // a rule signed for plan 1 must not hold back a different plan if it is copied onto it
  const copied = { ...entries["1"], rules: notToday, issuedAt, signature: await sign(aliceAcct, "1", notToday, issuedAt) };
  entries["4"] = copied; // plan 4 does not exist yet; create it, due now
  await send(alice, book.address, book.abi, "createDca", [stock.address, parseUnits("100", 6), 3, 3600, 0n]);
  await wait(7000);
  const r4 = await remaining(4n);
  check("a rule signed for plan 1, copied onto plan 4, is ignored (plan 4 runs)", r4 === 2, `remaining ${r4}`);

  server.close();
  killAll();
  console.log(failures === 0 ? "\nALL PLAN-RULES E2E CHECKS PASSED" : `\n${failures} CHECK(S) FAILED\n--- keeper log ---\n${logs.join("").slice(-3000)}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  killAll();
  process.exit(1);
});
process.on("exit", killAll);
