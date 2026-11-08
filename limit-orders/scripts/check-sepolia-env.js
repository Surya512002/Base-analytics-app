// check-sepolia-env.js: inspects limit-orders/.env without logging keys
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const envPath = path.join(__dirname, '../.env');

async function main() {
  if (!fs.existsSync(envPath)) {
    console.log('STATUS: NOT_FOUND');
    console.log('Reason: limit-orders/.env file does not exist.');
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      env[k] = v;
    }
  }

  const rpcUrl = env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
  const deployerPk = env.DEPLOYER_PK;
  const keeperPk = env.KEEPER_PK;

  console.log('=== Sepolia Pre-flight Wallet Check ===');
  console.log(`RPC URL: ${rpcUrl}`);

  if (!deployerPk) {
    console.log('DEPLOYER_PK: MISSING in limit-orders/.env');
  }
  if (!keeperPk) {
    console.log('KEEPER_PK: MISSING in limit-orders/.env');
  }

  if (!deployerPk || !keeperPk) {
    console.log('\nSTATUS: INCOMPLETE_ENV');
    console.log('Reason: Missing DEPLOYER_PK or KEEPER_PK in limit-orders/.env.');
    return;
  }

  try {
    const deployerWallet = new ethers.Wallet(deployerPk);
    const keeperWallet = new ethers.Wallet(keeperPk);
    console.log(`Deployer Address: ${deployerWallet.address}`);
    console.log(`Keeper Address:   ${keeperWallet.address}`);

    if (deployerWallet.address.toLowerCase() === keeperWallet.address.toLowerCase()) {
      console.log('ERROR: DEPLOYER_PK and KEEPER_PK must be two distinct wallets!');
      return;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const deployerBal = await provider.getBalance(deployerWallet.address);
    const keeperBal = await provider.getBalance(keeperWallet.address);

    const depEth = Number(ethers.formatEther(deployerBal));
    const keepEth = Number(ethers.formatEther(keeperBal));

    console.log(`Deployer Sepolia ETH Balance: ${depEth.toFixed(4)} ETH (${deployerBal.toString()} wei)`);
    console.log(`Keeper Sepolia ETH Balance:   ${keepEth.toFixed(4)} ETH (${keeperBal.toString()} wei)`);

    const depFunded = depEth >= 0.01;
    const keepFunded = keepEth >= 0.01;

    if (depFunded && keepFunded) {
      console.log('\nSTATUS: FUNDED');
    } else {
      console.log('\nSTATUS: UNFUNDED');
      console.log(`Reason: Insufficient balance. Deployer funded: ${depFunded} (has ${depEth} ETH, needs 0.01 ETH). Keeper funded: ${keepFunded} (has ${keepEth} ETH, needs 0.01 ETH).`);
    }
  } catch (err) {
    console.log(`ERROR during wallet verification: ${err.message}`);
  }
}

main().catch(console.error);
