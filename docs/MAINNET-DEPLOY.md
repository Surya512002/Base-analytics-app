# Mainnet deployment runbook (Base, chain 8453)

This deploys the order book with **canary limits ($50 per order, $500 total per market)**, so real-world testing on mainnet risks at most a few hundred dollars per market while you learn how it behaves. Limits are raised later from the Safe, without redeploying.

> Read `docs/SECURITY-REVIEW-ORDERBOOK.md` first. The contract is **not externally audited**. Canary limits are what make a mainnet test responsible. Do not skip them.

## Roles and keys (set these up first)

| Role | What it is | Can do | Must NOT be |
|---|---|---|---|
| **Owner** | A Safe multisig (2-of-3 or better) | set markets, limits, fees, unpause | an EOA, or the same as any key below |
| **Deployer** | A fresh hot wallet with ~0.01 ETH | deploys, wires markets, then hands ownership to the Safe | reused for anything else |
| **Guardian** | A separate hot key (e.g. on your phone) | **pause only** | the owner or deployer |
| **Keeper** | A server wallet with ~0.01 ETH for gas | execute orders, earns 0.10% fee | holding user funds (it never does) |

The deploy script refuses mainnet if `OWNER_ADDRESS` is missing or equals the deployer, if the guardian equals either, or without `CONFIRM_MAINNET=yes`.

> **Deployed 2026-11-21 (Base mainnet, canary limits).** Deployer `0x8F94…3Fd1` (not the `0xbCDD…7148` wallet used in the commands below; that is what the key in `.env` belongs to). LimitOrderBook `0x080D52b060A467aE63d7d2cC7178dc6B1A3DB29D`, UniswapV3Adapter `0xfBa0eA0387F4d04aBA22e9e89876Ec2782e685f4`, guardian `0xB4BD…d42F`, keeper fee 0.10%. Record: `limit-orders/deployments/base-mainnet.json`. **Still to do:** the Safe must call `acceptOwnership()` on both contracts (step 3), then start the keeper (step 4) and set the Vercel variables (step 5). Until step 3 the deployer key still owns the contracts.

## 1. Rehearse on a mainnet fork (no keys, no cost)

```bash
cd limit-orders && npm ci
```

```bash
npx hardhat test
```

```bash
npx hardhat run scripts/fork-rehearsal.js
```

The rehearsal runs the real deploy path with the canary profile and a Safe owner, accepts ownership, then sells WETH and buys cbBTC through the **real** Uniswap pools at the **live** Chainlink price, and checks the guardian pause, cancel-while-paused and escrow accounting. It must end with `REHEARSAL PASSED`.

Tokenized stocks cannot be simulated locally (Coinbase B20 precompile). Their first real test is step 4.

## 2. Deploy

Put the deployer key in `limit-orders/.env` (git-ignored) as `DEPLOYER_PK=0x…` and a private RPC as `BASE_RPC_URL=…`. Then:

```bash
DEPLOY_CONFIG=config/mainnet-canary.json EXPECTED_DEPLOYER=0xbCDDd1bc8F3c0c24BEDEE41720287ff50a7B7148 OWNER_ADDRESS=0x5b2247D29b44510E3E857879470925ccFFE696C3 CONFIRM_MAINNET=yes npx hardhat run scripts/deploy.js --network base
```

The keeper `0x8EB3…A628` is allowlisted automatically (it is in `keepers` in the config and `KEEPER_ADDRESS` in `limit-orders/.env`). Fund it with ~0.005 ETH on Base before starting it.

Owner Safe `0x5b22…96C3` was checked on 2026-11-16: 2 of 3 signatures on Base. Add `GUARDIAN_ADDRESS=0x…` to the command if you have a guardian ready; otherwise set it later from the Safe with `setGuardian(address)` on the order book.

`EXPECTED_DEPLOYER` makes the script refuse to run if the key in `.env` belongs to a different wallet. Estimate the cost first (nothing is sent):

```bash
DEPLOYER_ADDRESS=0xbCDDd1bc8F3c0c24BEDEE41720287ff50a7B7148 npx hardhat run scripts/estimate-deploy-gas.js
```

On 2026-11-16 this measured ~6.9M gas (contract built with `viaIR` to stay under the 24 KB limit), about 0.0004 ETH with margin, against a balance of 0.00105 ETH.

The deploy prints both addresses and writes `limit-orders/deployments/base-mainnet.json`. Commit that file.

## 3. Hand over ownership

In the Safe app, add two transactions and execute them together:

- `acceptOwnership()` on the **LimitOrderBook**
- `acceptOwnership()` on the **UniswapV3Adapter**

Until both are executed the deployer still owns the contracts. After they are, delete `DEPLOYER_PK` from `.env`.

Verify the source on Basescan:

```bash
npx hardhat verify --network base <ORDER_BOOK> 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 <DEPLOYER_ADDRESS> 10
```

```bash
npx hardhat verify --network base <ADAPTER> <ORDER_BOOK> 0x2626664c2603336E57B271c5C0b26F421741e481 <DEPLOYER_ADDRESS>
```

(Constructor args use the deployer as the initial owner; ownership moved to the Safe afterwards.)

Then check the live state against config:

```bash
DEPLOY_CONFIG=config/mainnet-canary.json BOOK_ADDRESS=<ORDER_BOOK> node scripts/plan-cap-update.mjs
```

It should report that on-chain caps already match the canary profile.

## 4. Start the keeper

Run it on an always-on host (a small VM, Railway, Fly.io). Environment:

```
CHAIN=base
RPC_URL=<private Base RPC>
ORDER_BOOK=<ORDER_BOOK>
KEEPER_PK=0x<keeper key>
POLL_MS=10000
MIN_GAS_BALANCE_ETH=0.002
```

The keeper wallet must be allowlisted (`KEEPER_ADDRESS` at deploy, or `setKeeper(addr, true)` from the Safe); it refuses to start otherwise. Try it with `DRY_RUN=1` first, then:

```bash
npm run keeper
```

## 5. Turn it on in the app

Set these in Vercel (Production) and redeploy the app:

```
NEXT_PUBLIC_LIMIT_ORDER_BOOK_MAINNET=<ORDER_BOOK>
NEXT_PUBLIC_LIMIT_ORDER_ADAPTER_MAINNET=<ADAPTER>
NEXT_PUBLIC_LIMIT_ORDERS_ENABLED=true
```

The app reads limits from the chain, so the Trade page will show the $50 canary limit automatically.

## 6. Canary test with your own wallet

Follow `docs/MAINNET-CANARY.md` with **$2–$10 per step** on every market, including:

- Limit buy, take-profit, stop-loss, trailing stop, bracket (OCO), edit, cancel
- Recurring buy **and** recurring sell, then cancel (unused part refunded)
- Scale order (3 legs), cancel one leg
- Guardian: pause, confirm cancel still works, owner unpauses

Stop on anything unexpected: a revert you can't explain, a balance mismatch, or a stock token transfer blocked by the issuer.

## 7. Raise limits in steps

After a clean week, raise limits from the Safe. `plan-cap-update.mjs` prints the transactions:

| Stage | When | Per order | Total per market |
|---|---|---|---|
| Canary | deploy | $50 | $500 |
| Beta | 1 clean week, keeper healthy | WETH/cbBTC $1,000, NVDAc $500 | $10,000 |
| Open | external audit done | values in `deployConfig.json` (WETH/cbBTC $25k) | $100k crypto, ~$5k stocks |

## Emergency

- **Something looks wrong:** guardian calls `pause()`. New orders and fills stop; every user can still cancel and withdraw.
- **One market misbehaves:** Safe calls `setMarket(..., enabled=false)` for it.
- **Changing a feed or adapter** on a live market: `queueRiskChange` from the Safe, wait 2 days, then `applyRiskChange`. Users see a warning in the app during the wait.
- **Keeper down:** the Safe can allowlist another keeper, or call `setKeeperOnly(false)` temporarily.
- There is no function that moves user funds to the owner or guardian.

## Monitoring checklist

- Keeper gas balance above 0.002 ETH
- Failed executions in keeper logs (FillBelowOracleBound means the pool drifted from the oracle; StalePrice means a feed paused)
- `stockEscrowed` / `quoteEscrowed` per market vs. the token balances of the book
- Chainlink feed age per market

## Fees and running costs

**What users pay.** An order fills at its price minus the pool fee (0.3% on most stock pools, 1% on MSFTc) and a
**keeper fee of 0.10%** of the amount received. The keeper fee goes to whichever allowlisted wallet executes the order. That
wallet is ours, so the keeper fee is the app's revenue from orders. The Trade page already shows it ("Fee: 0.10%").
The contract caps it at 1%, and the Safe can change it any time with `setKeeperFeeBps(bps)` (no redeploy, no new review),
so start low and adjust after you see real volume.

**How 0.10% compares** (figures from public write-ups on 2026-11-20; check each protocol's own docs before quoting them):

| Product | What it charges |
|---|---|
| Mean Finance (recurring buys) | about 0.6% of each swap |
| CoW Swap (limit orders) | one comparison says 2 bps of volume plus half of any price improvement; an older write-up says no fee, so the sources disagree |
| 1inch limit orders | no on-top fee (a vendor post, dated) |
| This app's market swaps | 0.25% |
| **This app's orders (keeper fee)** | **0.10%**, below Mean Finance and below our own swap fee |

**What it costs us.**
- **Gas:** Base gas is about 0.006 gwei right now, so one execution costs roughly a cent or less. At 0.10%, an order of about
  $10 or more already covers its own gas; at the $50 canary cap each fill earns about $0.05.
- **The keeper:** one small process. A free or small plan on Railway or Fly.io is enough (about $0 to $5 a month).
- **RPC calls:** the keeper polls the chain. Set `POLL_MS=10000` (10 s) instead of 5 s to halve the calls; a stop-loss
  firing 10 seconds later is fine here. A free-tier Base RPC key is enough at canary volume.
- **Gas balance:** the keeper only warns when its ETH is below `MIN_GAS_BALANCE_ETH` (default 0.002, about $3.50, which
  covers hundreds of executions at today's gas). Top up when you see the warning.
- **No other running costs:** no database, no extra servers. Orders live on chain and the app reads them directly.

**Expect small revenue at first.** With $50 caps, real volume decides it: 1,000 fills a month at $50 each is about $50 of
fees. It grows only when the caps are raised in steps (section 7) after the canary is clean.
