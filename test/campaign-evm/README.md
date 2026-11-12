# BaseVoucherCampaign EVM tests

Runs the real compiled contract in an in-process EVM (no Foundry needed). 40 checks: 50-claim
cap, one claim per wallet, tickets, expiry/commit, refunds, fee-on-transfer, reentrancy.

```bash
npm i --no-save solc@0.8.28 @ethereumjs/vm@8.1.1 @ethereumjs/common@4.4.0 @ethereumjs/util@9.1.0 @ethereumjs/block @ethereumjs/evm@3.1.1
mkdir -p test/campaign-evm/out
node test/campaign-evm/compile.cjs contracts/BaseVoucherCampaign.sol test/campaign-evm/out/campaign.json
node test/campaign-evm/compile.cjs test/campaign-evm/Mock.sol test/campaign-evm/out/mock.json
node test/campaign-evm/campaign-evm.run.cjs
```

Compiles for `shanghai` because the in-process EVM predates Cancun; Base itself supports newer targets.
