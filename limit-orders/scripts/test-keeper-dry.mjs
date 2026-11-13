import { spawn } from 'child_process';
import path from 'path';

console.log('Testing keeper startup in dry run...');
const proc = spawn('cmd.exe', ['/c', 'npx', 'tsx', 'keeper/keeper.ts'], {
  cwd: path.resolve('limit-orders'),
  env: {
    ...process.env,
    DRY_RUN: '1',
    CHAIN: 'baseSepolia',
    RPC_URL: 'https://sepolia.base.org',
    ORDER_BOOK: '0xC7fBA8EB5442760F83266C32F3Bc2E5c65079e46',
    POLL_MS: '3000'
  }
});

proc.stdout.on('data', (d) => process.stdout.write(`KEEPER: ${d}`));
proc.stderr.on('data', (d) => process.stderr.write(`KEEPER ERR: ${d}`));

setTimeout(() => {
  console.log('Stopping keeper...');
  proc.kill('SIGINT');
  process.exit(0);
}, 6000);
