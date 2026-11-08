// Part B2: Simulate real-token transfers with eth_call
const { ethers } = require('ethers');

const RPC_URL = process.env.BASE_MAINNET_RPC || 'https://mainnet.base.org';
const provider = new ethers.JsonRpcProvider(RPC_URL);

const TOKENS = [
  { symbol: 'NVDAc', address: ethers.getAddress('0xb20000000000000000000078ee7ce2fE4908108C'.toLowerCase()), pool: ethers.getAddress('0x60661b315553EB81872deEA9a66d567Cf0CCd33B'.toLowerCase()) },
  { symbol: 'AAPLc', address: ethers.getAddress('0xb200000000000000000000C2e324d24d7eEcd1fb'.toLowerCase()), pool: ethers.getAddress('0x97F35d1E92795327614BE000cd18cba1Be2c1931'.toLowerCase()) },
  { symbol: 'GOOGLc', address: ethers.getAddress('0xb2000000000000000000002D0BA3164cc74f58B7'.toLowerCase()), pool: ethers.getAddress('0x8634EE4145A63E40E44e12A6Bb1B905Fcb8856a6'.toLowerCase()) },
  { symbol: 'MSFTc', address: ethers.getAddress('0xB200000000000000000000Ab99cFa739E253872B'.toLowerCase()), pool: ethers.getAddress('0xD73cBeCC0F62C7C1704332ED119514d6d84DC607'.toLowerCase()) }
];

const DESTINATIONS = [
  { label: '(i) Fresh EOA', address: '0x1111111111111111111111111111111111111111' },
  { label: '(ii) Deployed Contract (Multicall3)', address: '0xcA11bde05977b3631167028862bE2a173976CA11' }
];

const iface = new ethers.Interface(['function transfer(address to, uint256 amount) returns (bool)']);
const amount = 100n; // 100 raw units

async function main() {
  console.log(`Connecting to: ${RPC_URL}`);
  const block = await provider.getBlockNumber();
  console.log(`Block Number: ${block}\n`);

  for (const t of TOKENS) {
    console.log(`=================== ${t.symbol} (${t.address}) ===================`);
    console.log(`Holder (from): Uniswap Pool ${t.pool}`);

    for (const d of DESTINATIONS) {
      const data = iface.encodeFunctionData('transfer', [d.address, amount]);
      try {
        const result = await provider.call({
          from: t.pool,
          to: t.address,
          data: data
        });
        const decoded = iface.decodeFunctionResult('transfer', result);
        console.log(`  -> ${d.label} (${d.address}): SUCCESS (raw return: ${result}, decoded: ${decoded[0]})`);
      } catch (err) {
        console.log(`  -> ${d.label} (${d.address}): REVERTED!`);
        console.log(`     Error Code: ${err.code}`);
        console.log(`     Short Message: ${err.shortMessage || err.message}`);
        if (err.data) console.log(`     Revert Data: ${err.data}`);
      }
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
