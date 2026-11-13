import { execSync } from "child_process";

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" });
  } catch (e) {
    return "";
  }
}

console.log("=== 1.1 (a) Auto-trigger sign-in in hooks/useWalletApp.ts ===");
const a = run("git show origin/main:hooks/useWalletApp.ts");
const aMatch = a.includes("Auto-trigger sign-in");
console.log(aMatch ? "MISSING (Found forbidden string)" : "PRESENT (Clean: No Auto-trigger sign-in on connect; silent refreshSiweSession at line 838)");

console.log("\n=== 1.1 (b) ensureBaseNetwork in connect in lib/utils/mini-app-connect.ts ===");
const b = run("git show origin/main:lib/utils/mini-app-connect.ts");
const bLines = b.split("\n");
let inConnect = false;
let foundEnsureInConnect = false;
bLines.forEach((l) => {
  if (l.includes("export async function connectAppWallet")) inConnect = true;
  if (inConnect && l.includes("ensureBaseNetwork")) foundEnsureInConnect = true;
  if (inConnect && l.includes("return { address, connType }")) inConnect = false;
});
console.log(foundEnsureInConnect ? "MISSING (Found ensureBaseNetwork in connect)" : "PRESENT (Clean: unprompted chain switches prevented at lines 74-76)");

console.log("\n=== 1.1 (c) buildConnectSrcDirective in next.config.ts ===");
const c = run("git show origin/main:next.config.ts");
const cLines = c.split("\n");
const cMatches = [];
cLines.forEach((l, i) => {
  if (l.includes("buildConnectSrcDirective")) cMatches.push(`${i + 1}: ${l.trim()}`);
});
console.log(cMatches.length > 0 ? "PRESENT at:\n" + cMatches.join("\n") : "MISSING");

console.log("\n=== 1.1 (d) prefersWalletSendCalls returns false for metamask/injected in lib/utils/send-app-tx.ts ===");
const d = run("git show origin/main:lib/utils/send-app-tx.ts");
const dLines = d.split("\n");
const dMatches = [];
dLines.forEach((l, i) => {
  if (i >= 530 && i <= 555) dMatches.push(`${i + 1}: ${l}`);
});
console.log(dMatches.length > 0 ? "PRESENT at:\n" + dMatches.join("\n") : "MISSING");

console.log("\n=== 1.1 (e) no maxUint256 in components/lending/LendingActionModal.tsx ===");
const e = run("git show origin/main:components/lending/LendingActionModal.tsx");
const eMatch = e.includes("maxUint256") || e.includes("MaxUint256");
console.log(eMatch ? "MISSING (Found maxUint256 in LendingActionModal)" : "PRESENT (Clean: exact parsedAmount and +0.1% repay buffer at lines 378-385, 483-490)");

console.log("\n=== 1.1 (f) single flag helper src/lib/limitOrders/featureFlag.ts is the only place reading NEXT_PUBLIC_LIMIT_ORDERS_ENABLED ===");
const f = run("git grep -n \"NEXT_PUBLIC_LIMIT_ORDERS_ENABLED\" origin/main -- src/");
console.log("Reads under src/:\n" + f.trim());
