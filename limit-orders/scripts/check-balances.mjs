import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';

const envPath = path.resolve('limit-orders/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

let deployerPk = '';
let keeperPk = '';
let rpcUrl = 'https://sepolia.base.org';

for (const line of lines) {
  const [k, ...rest] = line.split('=');
  const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
  if (k === 'DEPLOYER_PK') deployerPk = val;
  if (k === 'KEEPER_PK') keeperPk = val;
  if (k === 'BASE_SEPOLIA_RPC_URL' && val) rpcUrl = val;
}

const provider = new ethers.JsonRpcProvider(rpcUrl);

async function main() {
  const network = await provider.getNetwork();
  console.log(`Network chainId: ${network.chainId}`);
  if (network.chainId !== 84532n) {
    throw new Error(`Expected chainId 84532 (Base Sepolia), got ${network.chainId}`);
  }

  const deployer = new ethers.Wallet(deployerPk, provider);
  const keeper = new ethers.Wallet(keeperPk, provider);

  const deployerBal = await provider.getBalance(deployer.address);
  const keeperBal = await provider.getBalance(keeper.address);

  const deployerEth = ethers.formatEther(deployerBal);
  const keeperEth = ethers.formatEther(keeperBal);

  console.log(`Deployer Address: ${deployer.address}`);
  console.log(`Deployer Balance: ${deployerEth} ETH`);
  console.log(`Keeper Address:   ${keeper.address}`);
  console.log(`Keeper Balance:   ${keeperEth} ETH`);

  const minRequired = ethers.parseEther('0.01');
  const deployerOk = deployerBal >= minRequired;
  const keeperOk = keeperBal >= minRequired;

  console.log(`Deployer >= 0.01 ETH: ${deployerOk ? 'PASS' : 'FAIL'}`);
  console.log(`Keeper >= 0.01 ETH:   ${keeperOk ? 'PASS' : 'FAIL'}`);

  if (!deployerOk || !keeperOk) {
    console.log('\nACTION REQUIRED: Fund the following address(es) on Base Sepolia:');
    if (!deployerOk) console.log(`  - Deployer: ${deployer.address} needs funding (current: ${deployerEth} ETH, minimum: 0.01 ETH)`);
    if (!keeperOk) console.log(`  - Keeper:   ${keeper.address} needs funding (current: ${keeperEth} ETH, minimum: 0.01 ETH)`);
    process.exit(2);
  }
}

main().catch(err => {
  console.error('Error checking balances:', err);
  process.exit(1);
});
