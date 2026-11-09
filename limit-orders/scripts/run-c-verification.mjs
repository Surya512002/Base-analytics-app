import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";

const timestamp = Date.now();
const logFilename = `c-cleanup-verification-${timestamp}.txt`;
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
    const out = execSync(cmd, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 50 * 1024 * 1024,
      env: { ...process.env, CI: "true" },
    });
    log(out);
  } catch (err) {
    if (err.stdout) log(err.stdout.toString());
    if (err.stderr) log(err.stderr.toString());
    log(`[EXIT CODE]: ${err.status}`);
  }
}

log(`=== C-CLEANUP VERIFICATION REPORT (feature/pro-orders) ===`);
log(`Generated: ${new Date().toISOString()}`);
log(`Working Directory: ${process.cwd()}`);

run("git branch --show-current", "1. Current Git Branch");
run("git status --short", "2. Git Working Tree Status");
run("git diff origin/main --stat -- next.config.ts lib/security/csp.ts", "3. CSP & Sanitization Git Diff Stat");
run("npm run typecheck", "4. TypeScript Typecheck (Zero Errors)");
run("npm run lint", "5. ESLint App Lint");
run("npx vitest run test/security/csp-connect-src.test.ts", "6. C1 CSP connect-src Unit Tests");
run("npx vitest run test/limitOrders/ test/compliance/limit-orders-feature-flag.test.ts", "7. Pro Orders Unit & Compliance Tests");
run("npx vitest run", "8. Full Vitest Test Suite");
run("npm run build", "9. Next.js Production Build");

fs.writeFileSync(logPath, lines.join("\n"), "utf8");
const logBuf = fs.readFileSync(logPath);
const logSha256 = crypto.createHash("sha256").update(logBuf).digest("hex").toUpperCase();

console.log(`\nVerification log written to: ${logPath}`);
console.log(`SHA-256: ${logSha256}`);
