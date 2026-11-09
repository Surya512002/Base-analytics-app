import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";

const timestamp = Date.now();
const logFilename = `p1-connect-flow-${timestamp}.txt`;
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

log(`=== P1 CONNECT-FLOW HARDENING ISOLATED BRANCH VERIFICATION ===`);
log(`Generated: ${new Date().toISOString()}`);
log(`Working Directory: ${process.cwd()}`);

run("git branch --show-current", "1. Current Git Branch");
run("git diff origin/main --stat", "2. Git Diff against origin/main");
run("git log origin/main..HEAD --oneline", "3. Isolated Commit on Branch");
run("npx tsc --noEmit", "4. TypeScript Typecheck");
run("npm run lint", "5. ESLint App Lint");
run("npx vitest run test/wallet/connect-flow-behavior.test.ts", "6. Connect Flow Invariant Vitest");
run("npx vitest run", "7. Full Vitest Test Suite");
run("npm run build", "8. Next.js Production Build");

fs.writeFileSync(logPath, lines.join("\n"), "utf8");
const logBuf = fs.readFileSync(logPath);
const logSha256 = crypto.createHash("sha256").update(logBuf).digest("hex").toUpperCase();

console.log(`\nVerification log written to: ${logPath}`);
console.log(`SHA-256: ${logSha256}`);
