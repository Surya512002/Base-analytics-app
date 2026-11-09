import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";

const timestamp = Date.now();
const logFilename = `p1-p7-final-verification-${timestamp}.txt`;
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

log(`=== BASE ANALYTICS APP: P1 - P7 MASTER VERIFICATION REPORT ===`);
log(`Generated: ${new Date().toISOString()}`);
log(`Working Directory: ${process.cwd()}`);

// P1 Checks
run("git log origin/main..fix/connect-flow-hardening --oneline", "P1.1 Isolated Commit on fix/connect-flow-hardening");
run("git diff origin/main..fix/connect-flow-hardening --stat", "P1.2 Git Diff Stat of fix/connect-flow-hardening against origin/main");

// P2 Checks
run("git log origin/main..fix/lending-exact-approvals --oneline", "P2.1 Isolated Commit on fix/lending-exact-approvals");
run("git diff origin/main..fix/lending-exact-approvals --stat", "P2.2 Git Diff Stat of fix/lending-exact-approvals against origin/main");
run("npx vitest run test/lending/lending-exact-approval.test.ts", "P2.3 Dedicated Lending Exact Approval Unit Tests");

// P3 Checks
run("git diff --stat -- next.config.ts", "P3.1 next.config.ts diff --stat (Line Endings Normalized)");
run("git diff --ignore-space-at-eol --stat -- next.config.ts", "P3.2 next.config.ts diff --ignore-space-at-eol --stat");
run("git diff next.config.ts", "P3.3 next.config.ts full diff (connect-src directive only)");

// P4 Checks
run("node -e \"const fs=require('fs'); console.log('security.txt exists:', fs.existsSync('public/.well-known/security.txt'));\"", "P4.1 Verify public/.well-known/security.txt Removed");
run("git grep -n -I \"PLACEHOLDER_\" -- . \":!node_modules\" \":!limit-orders/logs\" \":!.git\" || echo \"No PLACEHOLDER_ found in deployable codebase\"", "P4.2 Verify No PLACEHOLDER_ in deployable codebase");
run("git grep -n -C 2 \"TODO: Maintainer\" SECURITY.md", "P4.3 SECURITY.md doc TODO marker");

// P6 Checks
run("node -e \"const fs=require('fs'); console.log(fs.readFileSync('limit-orders/scripts/generate-k1-k8-log.mjs', 'utf8'));\"", "P6.1 Source Code of generate-k1-k8-log.mjs");

// P7 Checks
run("git status --short", "P7.1 Git Working Tree Status");
run("git branch -vv", "P7.2 Git Branches and Tracking Status");

fs.writeFileSync(logPath, lines.join("\n"), "utf8");
const logBuf = fs.readFileSync(logPath);
const logSha256 = crypto.createHash("sha256").update(logBuf).digest("hex").toUpperCase();

console.log(`\nMaster verification log written to: ${logPath}`);
console.log(`SHA-256: ${logSha256}`);
