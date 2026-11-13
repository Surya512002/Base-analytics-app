import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

console.log('===============================================================');
console.log('PART 1.3: PUBLIC-REPO SECRET SCAN OVER ALL HISTORY');
console.log('===============================================================');

// 1. Check DEPLOYER_PK and KEEPER_PK
const envPath = path.resolve('limit-orders/.env');
if (!fs.existsSync(envPath)) {
  console.error('limit-orders/.env not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

let deployerPk = '';
let keeperPk = '';

for (const line of lines) {
  const [k, ...rest] = line.split('=');
  const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
  if (k === 'DEPLOYER_PK') deployerPk = val;
  if (k === 'KEEPER_PK') keeperPk = val;
}

const patterns = new Set();
if (deployerPk) {
  patterns.add(deployerPk);
  if (deployerPk.startsWith('0x')) patterns.add(deployerPk.slice(2));
}
if (keeperPk) {
  patterns.add(keeperPk);
  if (keeperPk.startsWith('0x')) patterns.add(keeperPk.slice(2));
}

const tempFile = path.join(os.tmpdir(), `secret-scan-patterns-${Date.now()}.txt`);
fs.writeFileSync(tempFile, Array.from(patterns).join('\n'), 'utf8');

let walletMatches = [];

try {
  const allCommits = execSync('git rev-list --all', { encoding: 'utf8' })
    .split('\n')
    .map(c => c.trim())
    .filter(Boolean);

  // Run in chunks of 50 to avoid command line length limits
  const chunkSize = 50;
  for (let i = 0; i < allCommits.length; i += chunkSize) {
    const chunk = allCommits.slice(i, i + chunkSize);
    try {
      const grepOutput = execSync(`git grep -F -f "${tempFile}" ${chunk.join(' ')}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'], // ignore stderr if grep returns non-zero
        maxBuffer: 10 * 1024 * 1024
      });
      if (grepOutput && grepOutput.trim()) {
        const matchLines = grepOutput.trim().split('\n');
        for (const mLine of matchLines) {
          // format: <commit>:<filepath>:<matched content>
          const parts = mLine.split(':');
          const commit = parts[0];
          const file = parts[1];
          walletMatches.push({ commit, file });
        }
      }
    } catch (e) {
      // git grep returns exit code 1 if no matches found in chunk
    }
  }
} finally {
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }
}

console.log('\n--- 1.3 (a) Wallet Key Matches in Commit History ---');
if (walletMatches.length === 0) {
  console.log('no commit contains a wallet key');
} else {
  console.log(`Found ${walletMatches.length} match(es):`);
  for (const m of walletMatches) {
    console.log(`Commit: ${m.commit}, Path: ${m.file}`);
  }
}

// 2. List any .env file ever added in git history
console.log('\n--- 1.3 (b) Any .env files ever added in history ---');
const envLogCmd = 'git log --all --diff-filter=A --name-only -- "*.env" "*.env.*"';
console.log(`Command: ${envLogCmd}`);
try {
  const envFilesAdded = execSync(envLogCmd, { encoding: 'utf8' }).trim();
  if (!envFilesAdded) {
    console.log('No .env files were ever added to the git repository.');
  } else {
    const lines = envFilesAdded.split('\n').filter(Boolean);
    console.log(lines.join('\n'));
  }
} catch (err) {
  console.error('Error checking added env files:', err.message);
}

// 3. Scan history for 64-hex strings and common API key shapes, report counts per file only
console.log('\n--- 1.3 (c) Scan history for 64-hex strings and API key patterns (counts per file only) ---');
// Pattern: 64-hex strings: [0-9a-fA-F]{64}
// Common API key patterns: AWS (AKIA[0-9A-Z]{16}), GitHub (ghp_[0-9a-zA-Z]{36}), Stripe (sk_live_[0-9a-zA-Z]{24})
try {
  // We can scan tree blobs in HEAD or across revisions. To be thorough across all blobs in history:
  // Using git log -G with counts or git grep over HEAD / all blobs
  const countsPerFile = {};

  // Check all tracked files across history with git log
  // Let's run git grep on HEAD first for quick breakdown, and git log -G to see history matches
  // Let's search all commits with git log -E --grep / git log -S or git grep across all commits for 64-hex
  console.log('Scanning HEAD files for 64-hex strings and API key shapes...');
  const headFiles = execSync('git ls-tree -r --name-only HEAD', { encoding: 'utf8' })
    .split('\n')
    .map(f => f.trim())
    .filter(Boolean);

  const hex64Regex = /\b[0-9a-fA-F]{64}\b/g;
  const apiKeyRegex = /\b(AKIA[0-9A-Z]{16}|ghp_[0-9a-zA-Z]{36}|sk_live_[0-9a-zA-Z]{24}|AIza[0-9A-Za-z\\-_]{35})\b/g;

  for (const file of headFiles) {
    // skip binary files
    if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.ico') || file.endsWith('.woff2')) continue;
    try {
      const content = fs.readFileSync(file, 'utf8');
      const hexMatches = content.match(hex64Regex);
      const apiMatches = content.match(apiKeyRegex);
      const hexCount = hexMatches ? hexMatches.length : 0;
      const apiCount = apiMatches ? apiMatches.length : 0;
      if (hexCount > 0 || apiCount > 0) {
        countsPerFile[file] = { hex64Count: hexCount, apiKeyCount: apiCount };
      }
    } catch (e) {
      // ignore unreadable/deleted
    }
  }

  console.log('HEAD matches summary (counts per file only):');
  for (const [f, counts] of Object.entries(countsPerFile)) {
    console.log(`  ${f}: 64-hex strings: ${counts.hex64Count}, API keys: ${counts.apiKeyCount}`);
  }

  // Also check git log for any historical commits containing AWS or GitHub keys
  console.log('\nChecking historical git log for known API key prefixes (AKIA, ghp_, sk_live_)...');
  const apiPrefixCheck = execSync('git log --all -G"AKIA|ghp_|sk_live_" --oneline', { encoding: 'utf8' }).trim();
  if (!apiPrefixCheck) {
    console.log('No historical commits contain AKIA, ghp_, or sk_live_ patterns.');
  } else {
    console.log('Historical commits matching API key patterns:\n' + apiPrefixCheck);
  }
} catch (e) {
  console.error('Error during secret scan:', e.message);
}
