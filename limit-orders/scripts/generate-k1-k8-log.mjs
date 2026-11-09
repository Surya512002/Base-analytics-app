import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";

const timestamp = Date.now();
const logFilename = `k1-k8-verification-${timestamp}.txt`;
const logPath = path.resolve(process.cwd(), "limit-orders/logs", logFilename);

const lines = [];
function log(msg) {
  console.log(msg);
  lines.push(msg);
}

function run(cmd, desc) {
  log(`\n================================================================================`);
  log(`STEP: ${desc}`);
  log(`COMMAND: ${cmd}`);
  log(`================================================================================`);
  try {
    const out = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    log(out);
  } catch (err) {
    if (err.stdout) log(err.stdout.toString());
    if (err.stderr) log(err.stderr.toString());
    log(`[EXIT CODE]: ${err.status}`);
  }
}

log(`=== BASE ANALYTICS APP: K1 - K8 VERIFICATION REPORT ===`);
log(`Generated: ${new Date().toISOString()}`);
log(`Working Directory: ${process.cwd()}`);

run("git branch --show-current", "1. Current Git Branch");
run("git status --short", "2. Git Working Tree Status");
run("git diff --stat", "3. Git Diff Stat");
run("npx tsc --noEmit", "4. TypeScript Typecheck (Zero Errors)");
run("npx vitest run test/limitOrders/", "5. Limit Orders Unit & Security Allowlist Tests (Vitest)");
run("npx vitest run test/compliance/limit-orders-feature-flag.test.ts", "6. Feature Flag Compliance Tests (Vitest)");
run("npx vitest run test/wallet/connect-flow-behavior.test.ts", "7. Connect Flow & Invariant Tests (Vitest)");
run("npx vitest run lib/lending/", "8. Lending Exact-Approval Regression Tests (Vitest)");
run("npx playwright test e2e/problem1-browser-verification.spec.ts --project=desktop-chromium", "9. Playwright E2E Browser Suite (8 Scenarios, Active CSP)");

// 10. Screenshot Hashes
log(`\n================================================================================`);
log(`10. Playwright Generated Screenshots SHA-256 Hashes`);
log(`================================================================================`);
const screenshotDir = path.resolve(process.cwd(), "limit-orders/logs/screenshots");
if (fs.existsSync(screenshotDir)) {
  const files = fs.readdirSync(screenshotDir).filter((f) => f.endsWith(".png")).sort();
  for (const f of files) {
    const buf = fs.readFileSync(path.join(screenshotDir, f));
    const h = crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
    log(`${h}  ${f}`);
  }
}

fs.writeFileSync(logPath, lines.join("\n"), "utf8");
const logBuf = fs.readFileSync(logPath);
const logSha256 = crypto.createHash("sha256").update(logBuf).digest("hex").toUpperCase();

console.log(`\nVerification log written to: ${logPath}`);
console.log(`SHA-256: ${logSha256}`);
