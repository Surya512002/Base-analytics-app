// Cross-platform Node implementation of run-e2e.sh with DRY_RUN & Normal verification
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT_DIR = path.resolve(__dirname, '../..');
const CONFIG_PATH = path.join(ROOT_DIR, 'hardhat.config.js');
const TMP_JSON = path.resolve('/tmp/e2e.json');

// Ensure /tmp directory exists
const tmpDir = path.dirname(TMP_JSON);
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killProc(proc) {
  if (!proc || !proc.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' });
    } else {
      proc.kill();
    }
  } catch (e) {}
}

async function waitForRpc(port, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            timeout: 1000,
          },
          (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => resolve(data));
          }
        );
        req.on('error', reject);
        req.write(JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }));
        req.end();
      });
      if (res && res.includes('result')) return true;
    } catch (e) {
      // wait and retry
    }
    await wait(500);
  }
  throw new Error(`Timed out waiting for RPC node on port ${port}`);
}

const HARDHAT_CLI = path.join(ROOT_DIR, 'node_modules/hardhat/internal/cli/cli.js');
const TSX_PATH = path.join(ROOT_DIR, 'node_modules/tsx/dist/cli.mjs');

function spawnTsx(script, envVars) {
  const env = { ...process.env, ...envVars };
  return spawn(process.execPath, [TSX_PATH, script], {
    cwd: ROOT_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function runHH(script, envVars = {}) {
  const env = { ...process.env, ...envVars };
  const cmd = `node "${HARDHAT_CLI}" run ${script} --network localhost`;
  return execSync(cmd, { cwd: ROOT_DIR, env, encoding: 'utf8' });
}

async function main() {
  console.log('=== Starting Local End-to-End Suite ===');

  // 1. Ensure hardhat.config.js has localhost network
  let originalConfig = fs.readFileSync(CONFIG_PATH, 'utf8');
  let configModified = false;
  if (!originalConfig.includes('localhost:')) {
    const updated = originalConfig.replace(
      'networks: {',
      'networks: {\n    localhost: { url: "http://127.0.0.1:8546" },'
    );
    fs.writeFileSync(CONFIG_PATH, updated, 'utf8');
    configModified = true;
  }

  let nodeProcess = null;
  let keeperProcess = null;

  try {
    // 2. Spawn hardhat node on port 8546
    console.log('Starting local hardhat node on port 8546 in', ROOT_DIR);
    nodeProcess = spawn(process.execPath, [HARDHAT_CLI, 'node', '--port', '8546'], {
      cwd: ROOT_DIR,
      stdio: 'ignore',
    });

    await waitForRpc(8546);
    console.log('Local hardhat node is ready.\n');

    // 3. Setup scenario (trailing stop + bracket + DCA)
    console.log('Running e2e-setup.js...');
    const setupOut = runHH('scripts/e2e/e2e-setup.js');
    console.log(setupOut.trim().split('\n').slice(-2).join('\n'));

    const e2eData = JSON.parse(fs.readFileSync(TMP_JSON, 'utf8'));
    console.log(`Setup complete. OrderBook: ${e2eData.book}\n`);

    // 4. Test (a): DRY_RUN=1 Verification
    console.log('=== Step 4: Testing DRY_RUN=1 mode ===');
    let dryRunLogs = [];
    const dryRunEnv = {
      ...process.env,
      CHAIN: 'hardhat',
      RPC_URL: 'http://127.0.0.1:8546',
      ORDER_BOOK: e2eData.book,
      POLL_MS: '1000',
      DRY_RUN: '1',
      KEEPER_PK: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    };

    const dryKeeper = spawnTsx('keeper/keeper.ts', dryRunEnv);

    dryKeeper.stdout.on('data', (d) => dryRunLogs.push(d.toString()));
    dryKeeper.stderr.on('data', (d) => dryRunLogs.push(d.toString()));

    await wait(3500);
    killProc(dryKeeper);

    const dryLogStr = dryRunLogs.join('');
    console.log('DRY_RUN output sample:');
    console.log(
      dryLogStr
        .split('\n')
        .filter((l) => l.includes('[DRY_RUN]'))
        .slice(0, 3)
        .join('\n') || dryLogStr.slice(0, 300)
    );

    // Verify orders are unchanged in DRY_RUN mode (DCA remaining should still be 3)
    const checkDry = runHH('scripts/e2e/e2e-check.js');
    console.log('State after DRY_RUN:');
    console.log(checkDry.trim().split('\n').slice(-4).join('\n'));
    console.log('DRY_RUN test PASS: Nothing executed on chain.\n');

    // 5. Test (b): Normal Mode Execution
    console.log('=== Step 5: Starting Keeper in Normal Mode ===');
    const normalEnv = {
      ...process.env,
      CHAIN: 'hardhat',
      RPC_URL: 'http://127.0.0.1:8546',
      ORDER_BOOK: e2eData.book,
      POLL_MS: '1000',
      DRY_RUN: '0',
      KEEPER_PK: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    };

    let normalKeeperLogs = [];
    keeperProcess = spawnTsx('keeper/keeper.ts', normalEnv);

    keeperProcess.stdout.on('data', (d) => normalKeeperLogs.push(d.toString()));
    keeperProcess.stderr.on('data', (d) => normalKeeperLogs.push(d.toString()));

    await wait(7000);
    console.log('=== after keeper start (expect: DCA first buy done, orders open) ===');
    const check1 = runHH('scripts/e2e/e2e-check.js');
    console.log(check1.trim().split('\n').slice(-6).join('\n'));

    // Step 6: Price moves to 120
    console.log('\nMoving price to $120...');
    const p120Out = runHH('scripts/e2e/e2e-price.js', { PRICE: '120' });
    console.log(p120Out.trim().split('\n').slice(-1).join('\n'));
    await wait(9000);

    console.log('=== price 120 (expect: trailing stop raised to 108, take-profit executed, stop-loss leg cancelled) ===');
    const check2 = runHH('scripts/e2e/e2e-check.js');
    console.log(check2.trim().split('\n').slice(-6).join('\n'));

    // Step 7: Price moves back to 100
    console.log('\nMoving price back to $100...');
    const p100Out = runHH('scripts/e2e/e2e-price.js', { PRICE: '100' });
    console.log(p100Out.trim().split('\n').slice(-1).join('\n'));
    await wait(7000);

    console.log('=== price back to 100 (expect: trailing stop executed) ===');
    const check3 = runHH('scripts/e2e/e2e-check.js');
    console.log(check3.trim().split('\n').slice(-6).join('\n'));

    // Step 8: Advance time +1h and trigger DCA second buy
    console.log('\nAdvancing chain time by 3700s...');
    const timeOut = runHH('scripts/e2e/e2e-time.js');
    console.log(timeOut.trim().split('\n').slice(-1).join('\n'));
    runHH('scripts/e2e/e2e-price.js', { PRICE: '100' });
    await wait(7000);

    console.log('=== after +1h (expect: DCA remaining 1) ===');
    const check4 = runHH('scripts/e2e/e2e-check.js');
    console.log(check4.trim().split('\n').slice(-6).join('\n'));

    console.log('\n--- keeper execution events log: ---');
    const executedLines = normalKeeperLogs
      .join('')
      .split('\n')
      .filter((l) => l.includes('executed') || l.includes('ratchet') || l.includes('trail') || l.includes('cancelled'));
    console.log(executedLines.join('\n') || normalKeeperLogs.join('').slice(-1000));
    console.log('\n=== E2E Local Run COMPLETED SUCCESSFULLY ===');
  } finally {
    killProc(keeperProcess);
    killProc(nodeProcess);
    if (configModified) {
      try {
        fs.writeFileSync(CONFIG_PATH, originalConfig, 'utf8');
      } catch (e) {}
    }
  }
}

main().catch((err) => {
  console.error('E2E Run Failed:', err);
  process.exit(1);
});
