# Base orders for tokenized stocks (v2)

Escrow order book, Uniswap V3 adapter, keeper bot, and shared TypeScript math/ABI helpers for Base Analytics.

## What users get
| Feature | What it does |
|---|---|
| Limit buy | Buy a stock when the price falls to your level |
| Take-profit | Sell when the price rises to your level |
| Stop-loss | Sell when the price falls to your level |
| Trailing stop | A stop-loss that follows the price up (never down) |
| Bracket (OCO) | Take-profit + stop-loss from ONE deposit; when one fills the other is cancelled |
| Edit in place | Change an order's trigger / minimum without cancelling and re-creating it |
| Recurring buys (DCA) | Buy a fixed amount on a schedule, optionally only below a price ceiling |
| Oracle-bounded fills | Every fill must be within a set % of the Chainlink price, even if the user's own minimum is looser |
| Always-exit | Owners can cancel and withdraw at any time, even when paused; the contract owner can never move user funds |
| Stale-price protection | Nothing executes while the feed is stale (for example, market closed) |

## Verification & Test Suites

Run `npm ci` first.

| Command | What it checks | Scope |
|---|---|---|
| `npm test` | 75 contract & parity tests (Hardhat, in-process EVM) | Hermetic, zero network dependency |
| `npm run test:math` | Decimal, validation, expected out, fill-floor helpers | Pure TypeScript unit tests |
| `npm run typecheck` | Keeper bot + shared TypeScript types | Static analysis |
| `npm run e2e:local` | Local node + keeper: trailing stop, bracket, and DCA run end to end | Integration |
| `npm run test:fork` | Base Mainnet fork tests with real pools, USDC, and mocked stock tokens (0xef B20 precompile) | End-to-end mainnet simulation (NVDAc, AAPLc, MSFTc, GOOGLc) |

### Base Mainnet Fork Test & Token Scope Notice
```bash
# In limit-orders/.env (or environment):
BASE_FORK_RPC="https://mainnet.base.org" # or private RPC (Alchemy, QuickNode)

npm run test:fork
```
> [!NOTE] **Mocked Token Scope Notice for B20 Equities on Local Forks**
> Coinbase B20 token contracts on Base (`0xb200...`) use native op-geth Rust precompiles whose bytecode on-chain begins with `0xef`. Local EVM emulators (Hardhat EDR, Foundry REVM) do not implement Coinbase's private op-geth precompile and revert with invalid opcode on `0xef`. Therefore, on the local fork, stock token bytecodes are replaced via `hardhat_setCode` with standard ERC-20 bytecode while testing against real mainnet USDC, real Chainlink feed pricing, and real Uniswap SwapRouter02 routing.
>
> **Results: MOCKED TOKEN**
> What remains unproven on real B20 tokens until deployed on-chain or run against an official Coinbase geth node:
> - Real B20 token transfers to/from the order book contract
> - Issuer-level pause, freeze, or address blacklisting
> - Fee-on-transfer or custom transfer hooks
> - Rebasing, stock split, or corporate-action behaviors
This tests all 4 active stock markets (`NVDAc`, `AAPLc`, `MSFTc`, `GOOGLc`) on the "Base Mainnet Fork, MOCKED stock tokens" suite:
1. **(a)** Mocked stock token & real USDC deposit / withdraw to `LimitOrderBook.sol` (proves order book accounting logic; see notice above for unproven real B20 limits).
2. **(b)** Create, trigger, and execute Limit Buy, Take-Profit, Stop-Loss, Trailing Stop (ratchet & fill), and Bracket (OCO leg cancellation).
3. **(c)** Create DCA plan and execute 2 sequential scheduled recurring buys.
4. **(d)** Cancel and refund lifecycle paths with balance restoration.

---

## Deployment & Verification Safety

### Deployment Safeguards
The deployment script (`scripts/deploy.js`) includes safety gates to prevent accidental deployments:
- Refuses to deploy to Base Mainnet (Chain ID 8453) unless `CONFIRM_MAINNET=yes`.
- Enforces multi-sig or separate cold wallet governance: requires `OWNER_ADDRESS` to be set and **strictly different** from the deployer address on mainnet.
- Reads unified configuration from `config/deployConfig.json`.

```bash
# Dry run on local hardhat network (hermetic with mocks)
npx hardhat run scripts/deploy.js --network hardhat

# Deploy to Base Sepolia
npx hardhat run scripts/deploy.js --network baseSepolia

# Deploy to Base Mainnet (requires explicit confirmation and owner)
CONFIRM_MAINNET=yes OWNER_ADDRESS=0xYourSafeMultiSig npx hardhat run scripts/deploy.js --network base
```

### Post-Deployment State Verification
After deployment, run `scripts/verify-deployment.js` to cross-examine on-chain state against `config/deployConfig.json`:
```bash
BOOK_ADDRESS=0x... ADAPTER_ADDRESS=0x... npx hardhat run scripts/verify-deployment.js --network base
```
Validates:
- `owner`, `quoteToken`, `keeperFeeBps`, and `paused` state.
- Per-market configuration: `feed`, `adapter`, `maxStockIn`, `maxQuoteIn`, `maxStaleness`, `maxDeviationBps`, and adapter `poolFee`.

### Basescan Verification
Verify the deployed contracts on Basescan using `hardhat-verify`:
```bash
# Verify LimitOrderBook
npx hardhat verify --network base <BOOK_ADDRESS> <QUOTE_TOKEN_ADDRESS> <OWNER_ADDRESS> <KEEPER_FEE_BPS>

# Example:
# npx hardhat verify --network base 0x... 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 0xOwner 15

# Verify UniswapV3Adapter
npx hardhat verify --network base <ADAPTER_ADDRESS> <BOOK_ADDRESS> <SWAP_ROUTER02_ADDRESS>

# Example (Base SwapRouter02: 0x2626664c2603336E57B271c5C0b26F421741e481):
# npx hardhat verify --network base 0x... <BOOK_ADDRESS> 0x2626664c2603336E57B271c5C0b26F421741e481
```

---

## Production Keeper Bot Setup

The keeper bot (`keeper/keeper.ts`) monitors open orders and DCA plans onchain. It executes triggered limit buys, take-profits, and stop-losses, ratchets trailing stops upwards, and runs scheduled recurring buys.

### Required Environment Variables
| Variable | Description | Example |
|---|---|---|
| `RPC_URL` | WebSocket or HTTP Base RPC endpoint | `https://base-mainnet.g.alchemy.com/v2/...` |
| `PRIVATE_KEY` | EOA keeper account private key (funded with ETH for gas) | `0x...` |
| `BOOK_ADDRESS` | Address of deployed `LimitOrderBook` | `0x...` |
| `POLL_INTERVAL_MS` | Milliseconds between scan cycles (default: 5000) | `5000` |
| `DRY_RUN` | If `"true"`, logs executable transactions without sending | `"false"` |
| `WEBHOOK_URL` | (Optional) Discord/Slack alert webhook for keeper errors & low gas | `https://discord.com/api/webhooks/...` |

### Systemd Service Configuration
Create `/etc/systemd/system/base-orders-keeper.service`:
```ini
[Unit]
Description=Base Orders Keeper Bot
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/base-analytics-app/limit-orders
Environment=NODE_ENV=production
Environment=RPC_URL=https://mainnet.base.org
Environment=BOOK_ADDRESS=0x...
Environment=PRIVATE_KEY=0x...
Environment=POLL_INTERVAL_MS=5000
Environment=DRY_RUN=false
ExecStart=/usr/bin/npm run keeper
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```
Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable base-orders-keeper
sudo systemctl start base-orders-keeper
sudo journalctl -u base-orders-keeper -f
```

### Keeper Gas Monitoring & Alerts
- Keep the keeper EOA funded with at least **0.05 ETH**.
- At a Base L2 base fee of ~0.005 to 0.05 gwei, each keeper execution costs < $0.005.
- The keeper collects a `keeperFeeBps` cut (e.g. 15 bps = 0.15%) on fills directly in quote token (USDC), which can be periodically swept and converted to ETH.

---

## Beta Risk and Oracle Trust Assumptions

### 1. Coinbase B20 Token Architecture & Limitations of Read/Simulation Checks
Coinbase tokenized equities on Base (`NVDAc`, `AAPLc`, `MSFTc`, `GOOGLc`) are ERC-20 compliant tokens implemented via native node precompiles.
- **Read-only and Simulation Scope (`eth_call`):** While our mainnet read views (B1) confirm `name`, `symbol`, 8 decimals, pool liquidity, and unpaused status (`isPaused(0) == false`), and our simulated transfers (B2) succeed to fresh EOAs and Multicall3, **these simulations cannot prove full system escrow**. Specifically, `eth_call` simulation cannot prove:
  - Real token deposit and withdrawal through the order book contract escrow (`transferFrom` and subsequent contract `transfer`).
  - Runtime issuer freeze, address-level compliance blocklists, or administrative seizures.
  - Corporate-action handling (stock splits, stock dividends, mergers) during active trading.
- **Canary Requirement:** Only a real, small-value on-chain canary run (~$2 per step following [docs/MAINNET-CANARY.md](../docs/MAINNET-CANARY.md)) on mainnet can provide definitive proof of real token escrow, refund, and fill execution.

### 2. B20 Multiplier, Corporate Actions, and Compliance Policies
- **Balances vs. Multiplier:** According to the Base B20 specification, raw token balances do not change when a dividend or stock split occurs; instead, an on-chain multiplier (`uiMultiplier()`) changes to reflect the corporate action.
- **Feed Freezing During Corporate Actions:** When a corporate action or halt occurs, the price feed ceases updating. If staleness exceeds `maxStaleness` (90,000s / 25h), the contract strictly reverts execution, protecting users from fills against unadjusted prices.
- **On-Chain Compliance Policies:** B20 tokens support transfer policy registries. If an on-chain policy blocks an address (e.g. sanctions or jurisdiction restriction), a payout to that blocked address will revert, leaving the order open in escrow rather than losing funds.
- **Issuer Function Pauses:** Issuers possess role-based granular controls (`isPaused`) to independently pause `TRANSFER`, `MINT`, or `BURN`. Token and feed solvency/operational risks sit with the token issuer and oracle provider.
- **Jurisdiction:** Tokenized stocks are offered only in eligible jurisdictions outside the United States.

### 3. Chainlink Price Feeds & Operator
- **Docs-Based Specification:** According to official Base documentation, Chainlink equity feeds update on a 0.5% deviation threshold or at least once every 24 hours during standard U.S. market trading hours (Monday–Friday 9:30 AM – 4:00 PM EST).
- **Off-Hours Behavior:** Off-hours (nights, weekends, market holidays, corporate-action pauses), feeds stop updating and hold the last known value. Feeds report total-return (price x multiplier) values.
- Feeds (`AAPLc`, `NVDAc`, `MSFTc`, `GOOGLc`) are standard Chainlink `EACAggregatorProxy` contracts operated by Chainlink's Base aggregator owner (`0xf0Db7318A51a21C413CaDd4AbDC1E8a500fE5B1b`).
- Decimals: all equity feeds use 8 decimals ($123.45 = `12345000000`).

### 4. Weekend & Market-Closed Behavior
- Traditional stock exchanges operate Monday–Friday 9:30 AM to 4:00 PM EST.
- Over weekends and holidays, official Chainlink equity feeds pause price updates.
- **Max Staleness Enforcement**: Setting `maxStaleness = 90000` (25 hours) ensures that 25 hours after Friday close, all automated orders are strictly blocked from execution until markets reopen and the feed resumes on Monday.
- **Fill Protection Bound**: During trading hours, every single swap must settle within `maxDeviationBps` (300 bps / 3.0% for 0.3% pools, 350 bps / 3.5% for 1.0% pools) of the latest Chainlink price. If Uniswap pool liquidity fluctuates or slippage exceeds this bound, the transaction reverts and user funds remain safe in escrow.
- **UI Notice**: The user interface displays a factual notice: *"Price last updated X ago. Markets may be closed; orders execute at the last known price within the protection bound."*

### 5. Fee Tiers and Liquidity Migration
- Configured Uniswap V3 pools:
  - `NVDAc / USDC`: 0.3% fee tier (Pool: `0x60661b315553EB81872deEA9a66d567Cf0CCd33B`)
  - `AAPLc / USDC`: 0.3% fee tier (Pool: `0x97F35d1E92795327614BE000cd18cba1Be2c1931`)
  - `MSFTc / USDC`: 1.0% fee tier (Pool: `0xD73cBeCC0F62C7C1704332ED119514d6d84DC607`)
  - `GOOGLc / USDC`: 0.3% fee tier (Pool: `0x8634EE4145A63E40E44e12A6Bb1B905Fcb8856a6`)
- If liquidity migrates to another fee tier (e.g. MSFTc migrates to 0.05% or 0.3%), the contract owner can call `UniswapV3Adapter.setPoolFee(stockToken, newFee)` without needing to migrate or redeploy the `LimitOrderBook`.

### 6. Beta Caps
Beta order and DCA caps are strictly enforced on-chain via `LimitOrderBook.setMarket`:
- Maximum stock deposit per order: ~$100 equivalent
- Maximum USDC deposit per order / DCA plan: 100 USDC (`100_000_000` units)
- The frontend dynamically reads these caps directly from the contract (`book.getMarket(stockToken).maxStockIn`, `maxQuoteIn`) to keep the UI in sync.

---

## Directory Layout
- `contracts/LimitOrderBook.sol`: Escrow, order storage, matching logic, and DCA scheduler.
- `contracts/UniswapV3Adapter.sol`: Single-hop Uniswap V3 SwapRouter02 adapter with oracle-bound validation.
- `contracts/mocks/Mocks.sol`: Test mocks (MockERC20, MockFeed, MockRouter).
- `keeper/keeper.ts`: Autonomous keeper bot.
- `shared/abi.ts`, `shared/orderMath.ts`: Pure helpers and ABI bindings used by both the Next.js UI and keeper bot.
- `scripts/deploy.js`: Multi-market deployment script with mainnet safety checks.
- `scripts/verify-deployment.js`: Post-deployment state validator.
- `scripts/testnet-faucet.js`: Testnet token faucet for Base Sepolia.
- `test/`: 48 hermetic contract unit tests.
- `test-fork/`: Mainnet fork lifecycle test suite with real contracts.
