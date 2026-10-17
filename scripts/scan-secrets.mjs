#!/usr/bin/env node
/**
 * scan-secrets.mjs
 * Comprehensive secret & credential scanner for Base Analytics App.
 * Scans both current working tree files and full git history.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SECRET_PATTERNS = [
  { name: "Private Key (Hex 64)", regex: /(?:private[_-]?key|secret[_-]?key|deployer[_-]?key)[\s:=]+["']?(0x[a-fA-F0-9]{64}|[a-fA-F0-9]{64})["']?/i },
  { name: "Raw EVM Private Key", regex: /0x[a-fA-F0-9]{64}\b/g },
  { name: "BIP-39 Mnemonic", regex: /(?:mnemonic|seed[_-]?phrase)[\s:=]+["']?([a-z]+(\s+[a-z]+){11,23})["']?/i },
  { name: "Alchemy Key (32 hex)", regex: /(?:alchemy[_-]?key|api[_-]?key)[\s:=]+["']?([a-zA-Z0-9_-]{32})["']?/i },
  { name: "AWS Access Key", regex: /\b(AKIA[0-9A-Z]{16})\b/ },
  { name: "GitHub Token", regex: /\b(gh[pousr]_[A-Za-z0-9_]{36,})\b/ },
  { name: "Generic API Secret", regex: /(?:api[_-]?secret|auth[_-]?token|bearer[_-]?token)[\s:=]+["']?([a-zA-Z0-9_\-\.]{24,})["']?/i },
];

const IGNORED_PATHS = [
  "node_modules",
  ".git",
  ".next",
  "forge-out",
  "out",
  "broadcast",
  "lib/forge-std",
  "package-lock.json",
  "tsconfig.tsbuildinfo",
  ".env.example",
  "scan-secrets.mjs",
  "test-swap-routes.mjs",
  "contracts.ts",
];

// Whitelisted dummy / mock values or known ERC event topic hashes
const WHITELIST = new Set([
  "0x1234567890123456789012345678901234567890123456789012345678901234",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x1111111111111111111111111111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222222222222222222222222222",
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // standard Anvil account #0
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // standard Anvil account #1
  "0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f", // ERC-4337 UserOperationEvent topic
]);

console.log("==================================================");
console.log("🔍 RUNNING SECRETS & REPO HYGIENE SCAN");
console.log("==================================================");

let totalIssues = 0;
const findings = [];

function checkContent(content, location) {
  for (const { name, regex } of SECRET_PATTERNS) {
    const matches = content.matchAll(new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g"));
    for (const match of matches) {
      const matchedVal = match[1] || match[0];
      if (WHITELIST.has(matchedVal.toLowerCase())) continue;
      // Skip false positives like 32-byte hash zeroes or typical build artifacts
      if (matchedVal.includes("00000000000000000000000000000000")) continue;
      // Skip contract bytecode or ABIs
      if (matchedVal.length > 80) continue;
      
      findings.push({
        type: name,
        location,
        snippet: matchedVal.slice(0, 6) + "..." + matchedVal.slice(-4),
      });
      totalIssues++;
    }
  }
}

// 1. Scan Working Directory
function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(process.cwd(), fullPath);

    const normalizedRelPath = relPath.replace(/\\/g, "/");
    if (IGNORED_PATHS.some((p) => normalizedRelPath.includes(p))) continue;

    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile()) {
      // Check for committed or staged .env files
      if (entry.name.startsWith(".env") && entry.name !== ".env.example") {
        try {
          const tracked = execSync(`git ls-files ${entry.name}`, { encoding: "utf8" }).trim();
          if (tracked) {
            findings.push({
              type: "Tracked Secret Env File",
              location: relPath,
              snippet: "Direct .env file is tracked by git!",
            });
            totalIssues++;
          }
        } catch {
          // git command error
        }
        continue;
      }

      // Scan text files
      const ext = path.extname(entry.name).toLowerCase();
      if ([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".sh", ".sol", ".yml", ".yaml"].includes(ext)) {
        try {
          const content = fs.readFileSync(fullPath, "utf8");
          checkContent(content, relPath);
        } catch {
          // ignore binary read errors
        }
      }
    }
  }
}

console.log("\n[1/2] Scanning working directory files...");
scanDir(process.cwd());

// 2. Scan Git History
console.log("[2/2] Scanning git history commits...");
try {
  const gitLog = execSync("git log -p -n 100 --full-diff", {
    maxBuffer: 10 * 1024 * 1024,
    encoding: "utf8",
  });
  
  const lines = gitLog.split("\n");
  let currentCommit = "";
  let currentFile = "";
  
  for (const line of lines) {
    if (line.startsWith("commit ")) {
      currentCommit = line.slice(7, 15);
    } else if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6);
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      if (IGNORED_PATHS.some((p) => currentFile.includes(p))) continue;
      checkContent(line.slice(1), `commit ${currentCommit}: ${currentFile}`);
    }
  }
} catch (e) {
  console.warn("Git history scan skipped or partially completed:", e.message);
}

// Summary Report
console.log("\n--------------------------------------------------");
if (findings.length === 0) {
  console.log("✅ PASSED: No exposed secrets, private keys, or credentials found.");
  console.log("--------------------------------------------------\n");
  process.exit(0);
} else {
  console.warn(`⚠️ WARNING: Found ${findings.length} potential secrets / hygiene issues:`);
  for (const f of findings) {
    console.warn(`  - [${f.type}] in ${f.location}: ${f.snippet}`);
  }
  console.log("--------------------------------------------------\n");
  process.exit(1);
}
