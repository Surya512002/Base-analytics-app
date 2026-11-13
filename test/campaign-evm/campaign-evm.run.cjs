const viem = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { VM } = require('@ethereumjs/vm');
const { Common, Hardfork, Chain } = require('@ethereumjs/common');
const { Address, Account, hexToBytes, bytesToHex } = require('@ethereumjs/util');
const { Block } = require('@ethereumjs/block');
const camp = require('./out/campaign.json').BaseVoucherCampaign;
const mock = require('./out/mock.json');
let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('  PASS', m); } else { failed++; console.log('  FAIL', m); } };
(async () => {
  const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Shanghai });
  const vm = await VM.create({ common });
  let now = 1_800_000_000n;
  const blk = () => Block.fromBlockData({ header: { timestamp: now, number: 100n, gasLimit: 30_000_000n } }, { common });
  const addr = (i) => '0x' + i.toString(16).padStart(40, '0');
  const fund = async (a, eth = 1000n) => { await vm.stateManager.putAccount(Address.fromString(a), Account.fromAccountData({ balance: eth * 10n ** 18n })); };
  const bal = async (a) => (await vm.stateManager.getAccount(Address.fromString(a))).balance;
  const call = async (from, to, data, value = 0n) => {
    const r = await vm.evm.runCall({ caller: Address.fromString(from), to: to ? Address.fromString(to) : undefined, data: hexToBytes(data), value, gasLimit: 15_000_000n, block: blk() });
    return { ok: !r.execResult.exceptionError, ret: bytesToHex(r.execResult.returnValue), created: r.createdAddress && r.createdAddress.toString(), err: r.execResult.exceptionError && r.execResult.exceptionError.error };
  };
  const deployRaw = async (from, bytecode) => { const r = await call(from, null, bytecode); if (!r.created) throw new Error('deploy failed ' + r.err); return r.created; };
  const revertMsg = (r) => {
    if (r.ok) return null;
    try { if (r.ret.startsWith('0x08c379a0')) return viem.decodeErrorResult({ abi: [{ type: 'error', name: 'Error', inputs: [{ type: 'string' }] }], data: r.ret }).args[0]; } catch {}
    return r.err || 'revert';
  };
  const creator = addr(0xc0ffee);
  const signerAcct = privateKeyToAccount('0x' + '11'.repeat(32));
  await fund(creator, 10000n);
  for (let i = 1; i <= 60; i++) await fund(addr(0x1000 + i), 10n);
  const C = await deployRaw(creator, camp.bytecode);
  const abi = camp.abi;
  const enc = (fn, args) => viem.encodeFunctionData({ abi, functionName: fn, args });
  const lastId = async () => BigInt((await call(creator, C, enc('nextCampaignId', []))).ret) - 1n;
  // v2: the share link carries a private link key; the contract only knows its address.
  const link = privateKeyToAccount('0x' + '22'.repeat(32));
  const wrongLink = privateKeyToAccount('0x' + '33'.repeat(32));
  const LINK_TAG = viem.keccak256(viem.toBytes('BaseVoucherCampaign.v2.link'));
  const TICKET_TAG = viem.keccak256(viem.toBytes('BaseVoucherCampaign.v2.ticket'));
  const linkSig = (key, id, claimer) =>
    key.signMessage({ message: { raw: viem.keccak256(viem.encodeAbiParameters(viem.parseAbiParameters('bytes32,uint256,address,uint256,address'), [LINK_TAG, 1n, C, id, claimer])) } });
  const ZERO = '0x0000000000000000000000000000000000000000';
  const P = (o = {}) => ({ token: ZERO, totalAmount: 50n * 10n ** 16n, maxClaims: 50, linkSigner: link.address, unlockAt: 0n, expiresAt: 0n, claimSigner: ZERO, committed: false, message: 'gm', senderLabel: 'alice.base.eth', ...o });
  const claim = async (from, id, key = link, dl = 0n, t = '0x') => call(from, C, enc('claim', [id, await linkSig(key, id, from), dl, t]));
  const claimRaw = (from, id, sig, dl = 0n, t = '0x') => call(from, C, enc('claim', [id, sig, dl, t]));

  console.log('ETH campaign: first 50 claim from ONE link');
  let r = await call(creator, C, enc('createEthCampaign', [P()]), 50n * 10n ** 16n);
  ok(r.ok, 'create ok ' + (r.ok ? '' : revertMsg(r)));
  let all50 = true;
  for (let i = 1; i <= 50; i++) { r = await claim(addr(0x1000 + i), 1n); if (!r.ok) { all50 = false; console.log('   claim', i, revertMsg(r)); break; } }
  ok(all50, '50 distinct wallets claimed');
  r = await claim(addr(0x1000 + 51), 1n);
  ok(revertMsg(r) === 'All claims taken', '51st claim rejected: ' + revertMsg(r));
  ok((await bal(C)) === 0n, 'contract drained exactly to 0');

  console.log('Per-wallet / link / creator rules');
  await call(creator, C, enc('createEthCampaign', [P()]), 50n * 10n ** 16n);
  const id2 = await lastId();
  r = await claim(addr(0x1001), id2, wrongLink); ok(revertMsg(r) === 'Invalid link', 'wrong link key rejected');
  r = await claim(addr(0x1001), id2); ok(r.ok, 'first claim ok');
  r = await claim(addr(0x1001), id2); ok(revertMsg(r) === 'Already claimed', 'same wallet cannot double-claim');
  r = await claim(creator, id2); ok(revertMsg(r) === 'Creator cannot claim', 'creator cannot self-claim');
  r = await claim(addr(0x1002), 999n); ok(revertMsg(r) === 'Invalid campaign', 'unknown campaign rejected');

  console.log('Replay protection (Vercel Security Review base-analytics-app/1)');
  await call(creator, C, enc('createEthCampaign', [P({ maxClaims: 5, totalAmount: 5n * 10n ** 18n })]), 5n * 10n ** 18n);
  const idX = await lastId();
  const victimSig = await linkSig(link, idX, addr(0x1050));
  r = await claimRaw(addr(0x1050), idX, victimSig); ok(r.ok, 'first claimer claims with their wallet-bound proof');
  r = await claimRaw(addr(0x1051), idX, victimSig); ok(revertMsg(r) === 'Invalid link', 'observer replaying the published proof from another wallet is rejected');
  r = await claimRaw(addr(0x1051), idX + 1n, victimSig); ok(!r.ok, 'proof cannot be moved to another campaign');
  const tkt = await signerAcct.signMessage({ message: { raw: viem.keccak256(viem.encodeAbiParameters(viem.parseAbiParameters('bytes32,uint256,address,uint256,address,uint64'), [TICKET_TAG, 1n, C, idX, addr(0x1052), 0n])) } });
  r = await claimRaw(addr(0x1052), idX, tkt); ok(revertMsg(r) === 'Invalid link', 'a ticket signature cannot be used as a link proof');

  console.log('Create validation');
  r = await call(creator, C, enc('createEthCampaign', [P({ maxClaims: 1001, totalAmount: 1001n })]), 1001n); ok(revertMsg(r) === 'Invalid claim count', '>1000 claims rejected');
  r = await call(creator, C, enc('createEthCampaign', [P({ maxClaims: 51, totalAmount: 51n })]), 51n); ok(r.ok, '51 claims allowed (cap is 1000, was 50)');
  r = await call(creator, C, enc('createEthCampaign', [P({ totalAmount: 101n })]), 101n); ok(revertMsg(r) === 'Amount must split evenly', 'uneven split rejected');
  r = await call(creator, C, enc('createEthCampaign', [P()]), 1n); ok(revertMsg(r) === 'ETH amount mismatch', 'msg.value mismatch rejected');
  r = await call(creator, C, enc('createEthCampaign', [P({ committed: true })]), 50n * 10n ** 16n); ok(revertMsg(r) === 'Committed needs expiry', 'committed without expiry rejected');
  r = await call(creator, C, enc('createEthCampaign', [P({ senderLabel: 'x'.repeat(41) })]), 50n * 10n ** 16n); ok(revertMsg(r) === 'Label too long', 'long sender label rejected');
  r = await call(creator, C, enc('createEthCampaign', [P({ linkSigner: ZERO })]), 50n * 10n ** 16n); ok(revertMsg(r) === 'Empty link signer', 'empty link signer rejected');
  r = await call(creator, C, enc('createEthCampaign', [P({ expiresAt: now - 1n })]), 50n * 10n ** 16n); ok(revertMsg(r) === 'Already expired', 'already-expired rejected');

  console.log('Time lock / expiry / close');
  const t0 = now;
  await call(creator, C, enc('createEthCampaign', [P({ maxClaims: 2, totalAmount: 2n * 10n ** 18n, unlockAt: t0 + 100n, expiresAt: t0 + 1000n, committed: true })]), 2n * 10n ** 18n);
  const idT = await lastId();
  r = await claim(addr(0x1010), idT); ok(revertMsg(r) === 'Not unlocked yet', 'claim before unlock rejected');
  r = await call(creator, C, enc('close', [idT])); ok(revertMsg(r) === 'Committed until expiry', 'committed campaign cannot be closed early');
  now = t0 + 200n;
  r = await claim(addr(0x1010), idT); ok(r.ok, 'claim after unlock ok');
  r = await call(addr(0x1011), C, enc('close', [idT])); ok(revertMsg(r) === 'Only creator', 'non-creator cannot close');
  now = t0 + 1001n;
  r = await claim(addr(0x1012), idT); ok(revertMsg(r) === 'Campaign expired', 'claim after expiry rejected');
  const before = await bal(creator);
  r = await call(creator, C, enc('close', [idT]));
  ok(r.ok && (await bal(creator)) - before === 10n ** 18n, 'creator refunded exactly the 1 unclaimed share');
  r = await call(creator, C, enc('close', [idT])); ok(revertMsg(r) === 'Already closed', 'double close rejected');
  now = t0;

  console.log('Uncommitted cancel');
  await call(creator, C, enc('createEthCampaign', [P({ maxClaims: 2, totalAmount: 2n * 10n ** 18n })]), 2n * 10n ** 18n);
  const idU = await lastId();
  r = await call(creator, C, enc('close', [idU])); ok(r.ok, 'uncommitted campaign can be cancelled');
  r = await claim(addr(0x1020), idU); ok(revertMsg(r) === 'Campaign closed', 'claims blocked after close');

  console.log('Signed claim tickets (anti-bot / eligibility gate)');
  await call(creator, C, enc('createEthCampaign', [P({ maxClaims: 5, totalAmount: 5n * 10n ** 18n, claimSigner: signerAcct.address })]), 5n * 10n ** 18n);
  const idS = await lastId();
  const mk = async (claimer, deadline, id = idS) => {
    const inner = viem.keccak256(viem.encodeAbiParameters(viem.parseAbiParameters('bytes32,uint256,address,uint256,address,uint64'), [TICKET_TAG, 1n, C, id, claimer, deadline]));
    return signerAcct.signMessage({ message: { raw: inner } });
  };
  const w = addr(0x1030), dl = now + 600n;
  r = await claim(w, idS); ok(revertMsg(r) === 'Ticket expired', 'missing ticket rejected');
  r = await claim(w, idS, link, dl, await mk(addr(0x1031), dl)); ok(revertMsg(r) === 'Invalid ticket', 'ticket for another wallet rejected');
  r = await claim(w, idS, link, now + 7200n, await mk(w, now + 7200n)); ok(revertMsg(r) === 'Ticket TTL too long', 'over-long ticket TTL rejected');
  r = await claim(w, idS, link, dl, await mk(w, dl, idS + 1n)); ok(revertMsg(r) === 'Invalid ticket', 'ticket for another campaign rejected');
  r = await claim(w, idS, link, dl, await mk(w, dl)); ok(r.ok, 'valid ticket claims ' + (r.ok ? '' : revertMsg(r)));
  now = dl + 1n;
  r = await claim(addr(0x1032), idS, link, dl, await mk(addr(0x1032), dl)); ok(revertMsg(r) === 'Ticket expired', 'expired ticket rejected');
  now = t0;

  console.log('ERC20 (tokenized-stock-like)');
  const T = await deployRaw(creator, mock.MockToken.bytecode);
  const tenc = (fn, args) => viem.encodeFunctionData({ abi: mock.MockToken.abi, functionName: fn, args });
  await call(creator, T, tenc('mint', [creator, 1000n * 10n ** 18n]));
  await call(creator, T, tenc('approve', [C, 1000n * 10n ** 18n]));
  r = await call(creator, C, enc('createTokenCampaign', [P({ token: T, maxClaims: 10, totalAmount: 10n * 10n ** 18n })])); ok(r.ok, 'token campaign created ' + (r.ok ? '' : revertMsg(r)));
  const idK = await lastId();
  r = await claim(addr(0x1040), idK); ok(r.ok, 'token claim ok');
  const rb = await call(creator, T, tenc('balanceOf', [addr(0x1040)])); ok(BigInt(rb.ret) === 10n ** 18n, 'claimer received exactly 1 share');
  await call(creator, T, tenc('setFee', [100n]));
  r = await call(creator, C, enc('createTokenCampaign', [P({ token: T, maxClaims: 10, totalAmount: 10n * 10n ** 18n })])); ok(revertMsg(r) === 'Fee-on-transfer unsupported', 'fee-on-transfer token rejected');
  await call(creator, T, tenc('setFee', [0n]));
  r = await call(creator, C, enc('createTokenCampaign', [P({ token: addr(0xdead) })])); ok(!r.ok, 'non-contract token rejected');
  r = await call(creator, C, enc('createEthCampaign', [P({ token: T })]), 50n * 10n ** 16n); ok(revertMsg(r) === 'Token must be zero for ETH', 'ETH entrypoint rejects token address');
  const cbefore = await call(creator, T, tenc('balanceOf', [creator]));
  r = await call(creator, C, enc('close', [idK])); const cafter = await call(creator, T, tenc('balanceOf', [creator]));
  ok(r.ok && BigInt(cafter.ret) - BigInt(cbefore.ret) === 9n * 10n ** 18n, 'close refunds 9 unclaimed token shares');

  console.log('Reentrancy');
  const A = await deployRaw(creator, mock.Attacker.bytecode + viem.encodeAbiParameters(viem.parseAbiParameters('address'), [C]).slice(2));
  await call(creator, C, enc('createEthCampaign', [P({ maxClaims: 3, totalAmount: 3n * 10n ** 18n })]), 3n * 10n ** 18n);
  const idR = await lastId();
  await call(creator, A, viem.encodeFunctionData({ abi: mock.Attacker.abi, functionName: 'go', args: [idR, await linkSig(link, idR, A)] }));
  ok((await bal(A)) === 10n ** 18n, 'reentrant attacker received exactly one share (' + (await bal(A)) + ')');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
