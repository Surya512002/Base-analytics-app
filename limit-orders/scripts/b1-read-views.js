// Part B1: Read-only real-token checks against Base mainnet RPC
const { ethers } = require('ethers');

const RPC_URL = process.env.BASE_MAINNET_RPC || 'https://mainnet.base.org';
const provider = new ethers.JsonRpcProvider(RPC_URL);

const TOKENS = [
  { symbol: 'NVDAc', address: ethers.getAddress('0xb20000000000000000000078ee7ce2fE4908108C'.toLowerCase()), pool: ethers.getAddress('0x60661b315553EB81872deEA9a66d567Cf0CCd33B'.toLowerCase()), apiMultiplier: 1.0005379395763694 },
  { symbol: 'AAPLc', address: ethers.getAddress('0xb200000000000000000000C2e324d24d7eEcd1fb'.toLowerCase()), pool: ethers.getAddress('0x97F35d1E92795327614BE000cd18cba1Be2c1931'.toLowerCase()), apiMultiplier: 1.0 },
  { symbol: 'GOOGLc', address: ethers.getAddress('0xb2000000000000000000002D0BA3164cc74f58B7'.toLowerCase()), pool: ethers.getAddress('0x8634EE4145A63E40E44e12A6Bb1B905Fcb8856a6'.toLowerCase()), apiMultiplier: 1.0003771186767842 },
  { symbol: 'MSFTc', address: ethers.getAddress('0xB200000000000000000000Ab99cFa739E253872B'.toLowerCase()), pool: ethers.getAddress('0xD73cBeCC0F62C7C1704332ED119514d6d84DC607'.toLowerCase()), apiMultiplier: 1.0 }
];

// Potential B20 and standard ERC20 views
const VIEWS = [
  { name: 'name', fragment: 'function name() view returns (string)' },
  { name: 'symbol', fragment: 'function symbol() view returns (string)' },
  { name: 'decimals', fragment: 'function decimals() view returns (uint8)' },
  { name: 'totalSupply', fragment: 'function totalSupply() view returns (uint256)' },
  { name: 'uiMultiplier', fragment: 'function uiMultiplier() view returns (uint256)' },
  { name: 'multiplier', fragment: 'function multiplier() view returns (uint256)' },
  { name: 'newUIMultiplier', fragment: 'function newUIMultiplier() view returns (uint256, uint64)' },
  { name: 'paused', fragment: 'function paused() view returns (bool)' },
  { name: 'isPaused(0)', fragment: 'function isPaused(uint8) view returns (bool)', args: [0] }, // 0: TRANSFER
  { name: 'isPaused(1)', fragment: 'function isPaused(uint8) view returns (bool)', args: [1] }, // 1: MINT
  { name: 'isPaused(2)', fragment: 'function isPaused(uint8) view returns (bool)', args: [2] }, // 2: BURN
  { name: 'policyRegistry', fragment: 'function policyRegistry() view returns (address)' },
  { name: 'transferPolicyId', fragment: 'function transferPolicyId() view returns (uint256)' },
  { name: 'seizeWithMemo', fragment: 'function seizeWithMemo() view returns (bool)' }
];

async function main() {
  console.log(`Connected to RPC: ${RPC_URL}`);
  const blockNumber = await provider.getBlockNumber();
  console.log(`Current Block: ${blockNumber}`);

  for (const t of TOKENS) {
    console.log(`\n=================== ${t.symbol} (${t.address}) ===================`);
    console.log(`Coinbase API multiplier: ${t.apiMultiplier}`);

    // Check pool balance
    try {
      const c = new ethers.Contract(t.address, ['function balanceOf(address) view returns (uint256)'], provider);
      const bal = await c.balanceOf(t.pool);
      console.log(`balanceOf(pool ${t.pool}): ${bal.toString()} raw units (${ethers.formatUnits(bal, 8)} tokens)`);
    } catch (e) {
      console.log(`balanceOf(pool) REVERTED: ${e.message}`);
    }

    // Check views
    for (const v of VIEWS) {
      try {
        const c = new ethers.Contract(t.address, [v.fragment], provider);
        const methodName = v.fragment.match(/function\s+(\w+)/)[1];
        const res = v.args ? await c[methodName](...v.args) : await c[methodName]();
        if (Array.isArray(res)) {
          console.log(`  ${v.name}: [${res.map(x => x.toString()).join(', ')}]`);
        } else {
          console.log(`  ${v.name}: ${res.toString()}`);
        }
      } catch (err) {
        console.log(`  ${v.name}: REVERTED (${err.shortMessage || err.code || 'call exception'})`);
      }
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
