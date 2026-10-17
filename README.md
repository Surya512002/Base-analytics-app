# Base Terminal

High-performance trading, stocks discovery, lending comparisons, and token launch terminal on **Base** — trade tokenized equities, swap tokens with multi-DEX smart routing, compare lending and borrow yields, launch meme and stock-paired tokens with creator revenue sharing, and send **Base Voucher** crypto gift cards.

**Live Terminal:** [base-analytics-app.vercel.app](https://base-analytics-app.vercel.app)  
**Developer Documents:** [base-analytics-app.vercel.app/docs](https://base-analytics-app.vercel.app/docs)

---

## What Users Get

| Section | Key Highlights |
|---------|----------------|
| **Explore** | Token discovery, Coinbase tokenized equities (NVDAc, AAPLc, TSLAc, COINc, GOOGLc, MSFTc, AMZNc), 24h volume, interactive charts, watchlist & push price alerts |
| **Swap** | Smart multi-DEX routing across Uniswap v3, Aerodrome, Slipstream, 0x API fallback, and o1 quote routing with built-in **0.25% creator revenue fee sharing** |
| **Launchpad** | 3 token launch modes: **B20 vanity tokens** (0xB200... mining), **ERC-20 meme coins**, and **stock-paired memestocks** (paired with NVDAc or AAPLc) with anti-snipe protection and vesting schedules |
| **Lend & Stake** | Real-time yield comparisons across Morpho Blue, Aave v3, Euler, and Superform vaults with interactive **Collateral Health Factor Simulator** |
| **Base Voucher** | Decentralized crypto gift cards: split deposits into up to 50 cards supporting **ETH, USDC, Tokenized Stocks**, and **Morpho/Superform Yield Vault shares** (`mvNVDAc`, `mvAAPLc`, `sfNVDAc`, `mvCOINc`) |
| **AI Agents & MCP** | Official **Model Context Protocol (MCP)** server at `/api/mcp` enabling autonomous AI agents (Claude Desktop, Cursor, OpenAI GPTs) to prepare batches, query live statuses, and claim vouchers |
| **Creator Hub** | Onchain creator profiles (`/creator/[address]`), volume attribution, fee earnings, and verified Coinbase Builder Code attribution |
| **Wallet Analytics** | Base Activity Score (0–100), ERC-4337 smart account user ops, ERC-1155 achievements, daily check-in streaks, and Hall of Fame |

> [!TIP]
> Guests can browse **[/explore](https://base-analytics-app.vercel.app/explore)** and **[/lend](https://base-analytics-app.vercel.app/lend)** without connecting a wallet.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4, CSS Design Tokens (Blue Hour Meridian / Paylane system)
- **Web3 & Onchain:** Viem 2, Wagmi 2, Coinbase OnchainKit, Farcaster Mini-App SDK
- **Data & Caching:** Redis (`KV_REDIS_URL`) — token cache, voucher index, creator stats
- **DEX Aggregation:** Uniswap v3 Quoter/Router, Aerodrome Router & Slipstream, 0x Swap API v2, o1 trading
- **Autonomous Agents:** Model Context Protocol SDK (`@modelcontextprotocol/sdk`, `mcp-handler`)
- **Smart Contracts:** Foundry (`contracts/BaseVoucher.sol`)

---

## Public REST API Endpoints

All endpoints are publicly accessible from `https://base-analytics-app.vercel.app`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stocks` | Real-time Coinbase tokenized stocks feed, prices, 24h volume, NAV, and filters |
| `GET` | `/api/markets/lending` | Lending & borrow yields across Morpho Blue, Aave v3, and Superform |
| `GET` | `/api/launchpad/market` | Terminal-wide launchpad volume, market cap, and active tokens |
| `GET` | `/api/launchpad/tokens` | Paginated index of launched tokens with search and creator filter |
| `GET` | `/api/launchpad/quote` | Smart multi-DEX swap quotes with creator fee split and price impact |
| `GET` | `/api/launchpad/activity` | Live stream of token deployments, buys, sells, and liquidity events |
| `GET` | `/api/launchpad/holders` | Token holder distribution analysis and concentration metrics |
| `GET` | `/api/launchpad/calendar` | Scheduled token launch drops and mint calendar |
| `GET` | `/api/launchpad/protection` | Anti-snipe evaluation status and safety parameters |
| `GET` | `/api/voucher/card-preview` | Public gift card metadata lookup by Card ID (`batchId-cardIndex`) |
| `POST` | `/api/mcp` | Model Context Protocol JSON-RPC server for autonomous AI agents |
| `GET` | `/api/creator/[address]` | Creator analytics, launched tokens, lifetime volume, and fee earnings |
| `GET` | `/api/health` | Service health, Redis connectivity, and RPC latency check |

Interactive documentation and cURL code generators are available at **[/docs](https://base-analytics-app.vercel.app/docs)**.

---

## Model Context Protocol (MCP) for AI Agents

Base Terminal hosts a public remote MCP server at `https://base-analytics-app.vercel.app/api/mcp`.

### Connect with Claude Code / CLI:
```bash
claude mcp add --transport http base-voucher https://base-analytics-app.vercel.app/api/mcp
```

### Connect with Cursor / Claude Desktop:
Add to your `mcpServers` configuration:
```json
{
  "mcpServers": {
    "baseVoucher": {
      "url": "https://base-analytics-app.vercel.app/api/mcp"
    }
  }
}
```

### Available MCP Tools:
- `voucher_prepare_create`: Generate unsigned batch calldata and card secrets.
- `voucher_prepare_redeem`: Generate unsigned claim calldata for Card ID + Secret.
- `voucher_lookup_batch`: Query live onchain batch status, redeemed vs available cards.
- `voucher_list_by_creator`: List all batches created by a wallet with unredeemed stats.

---

## Verified Smart Contracts (Base Mainnet — Chain ID: 8453)

| Contract | Address | Standard / Purpose |
|----------|---------|-------------------|
| **Base Voucher Protocol** | `NEXT_PUBLIC_VOUCHER_CONTRACT` | Multi-asset crypto gift card protocol |
| **Achievements Registry** | `0xadb8120B4B18b892cFAD171243074487122Dea03` | ERC-1155 Soulbound & claimable badges |
| **Daily Check-In** | `0xABc7099C631E18640ea60b25116407aa17354FBb` | Streak counter & points registry |
| **Booster Contract** | `0x0d1BE33F8B6a33BeEe7b3bb834DF6f8c168B2e46` | Interactive XP multiplier module |
| **GM / GN Contract** | `0xdb4f873B33F448aeA8Bb2b3B7e3ab9561329608A` | Decentralized social provenance |
| **Base Standard Bridge** | `0x4200000000000000000000000000000000000010` | Canonical L1 ↔ L2 bridge |
| **ERC-4337 EntryPoint v0.6** | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | Smart account user ops execution |
| **ERC-4337 EntryPoint v0.7** | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | Upgraded account abstraction |
| **Base Builder Code** | `bc_4uoh9iu2` | Verified onchain builder attribution |

---

## Local Development Setup

```bash
git clone https://github.com/Surya512002/Base-analytics-app.git
cd Base-analytics-app
npm install
cp .env.example .env.local
# Fill in .env.local variables
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available Scripts & Release Readiness Suite

Run the full pre-flight verification with a single command:
```bash
npm run verify                  # One command: typecheck + lint + audit + secrets + tests + fork
```

### Individual Quality & Security Commands

```bash
# Code Quality & Static Analysis
npm ci                          # Clean dependency installation
npm run typecheck               # Run TypeScript compiler checks (0 errors)
npm run lint                    # Run ESLint validation
npm run audit                   # Run npm audit --omit=dev (production dependencies)
npm run build                   # Full production build (collector + next build)

# Secrets & Credential Scanning (Pre-Push Gate)
npm run secrets:scan            # Scan working directory & git history for exposed keys/tokens
npm run secrets:gitleaks        # Gitleaks container/CI scan

# Smart Contract Tests (Foundry & Vitest)
forge build                     # Compile contracts in contracts/ (Foundry)
forge test -vvv                 # Run unit & fuzz tests in test/ (Foundry)
forge coverage                  # Generate contract test coverage
slither .                       # Run Slither static security analysis
npm run contracts:test          # Run invariant tests in Vitest or Foundry
npm run contracts:deploy:dry-run# Simulate contract deployment without spending real gas

# Mainnet Fork & App Tests
npm run test:fork               # Run on-chain tests against Base mainnet fork / RPC
npm test                        # Run all Vitest unit and integration suites
npm run test:e2e                # Run Playwright end-to-end browser tests
npm run test:swap-routes        # Test live DEX routing against production URL
```

---

## Contract Address Registry (Base Mainnet — Chain ID: 8453)

All contract addresses are strictly centralized and checksummed in [`lib/contracts/registry.ts`](lib/contracts/registry.ts):

| Contract Name | Address | Category | Basescan | Verified Source |
| :--- | :--- | :--- | :--- | :--- |
| **Morpho Blue Singleton** | `0xBBBBBbbBBb9cC5e90e3b3Af62C37EEFFCb` | Protocol | [View](https://basescan.org/address/0xBBBBBbbBBb9cC5e90e3b3Af62C37EEFFCb) | [Morpho Docs](https://docs.morpho.org) |
| **Aave V3 Pool Base** | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` | Protocol | [View](https://basescan.org/address/0xA238Dd80C259a72e81d7e4664a9801593F98d1c5) | [Aave Docs](https://docs.aave.com) |
| **Moonwell Comptroller** | `0xFBB21d0380BEE3312b33c4353C793670a1640428` | Protocol | [View](https://basescan.org/address/0xFBB21d0380BEE3312b33c4353C793670a1640428) | [Moonwell Docs](https://docs.moonwell.fi) |
| **Moonwell mUSDC** | `0xeDc817A28E8B93Ca689afb215a5552c41326118B` | Protocol | [View](https://basescan.org/address/0xeDc817A28E8B93Ca689afb215a5552c41326118B) | [Moonwell Docs](https://docs.moonwell.fi) |
| **Moonwell mWETH** | `0x628ff693426583D9a7FB391E54366292F509D457` | Protocol | [View](https://basescan.org/address/0x628ff693426583D9a7FB391E54366292F509D457) | [Moonwell Docs](https://docs.moonwell.fi) |
| **Moonwell mcbBTC** | `0xf783307613576082D25089e9FC0a86b9A89345c2` | Protocol | [View](https://basescan.org/address/0xf783307613576082D25089e9FC0a86b9A89345c2) | [Moonwell Docs](https://docs.moonwell.fi) |
| **Aerodrome Router** | `0xcF77A3ba9A5ca399B7c97c748846942438557642` | Protocol | [View](https://basescan.org/address/0xcF77A3ba9A5ca399B7c97c748846942438557642) | [Aerodrome Docs](https://aerodrome.finance) |
| **Aerodrome Slipstream** | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` | Protocol | [View](https://basescan.org/address/0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5) | [Aerodrome Docs](https://aerodrome.finance) |
| **Platform Treasury** | `0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F` | Core | [View](https://basescan.org/address/0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F) | Safe Multisig |
| **CheckIn Streak** | `0xABc7099C631E18640ea60b25116407aa17354FBb` | Core | [View](https://basescan.org/address/0xABc7099C631E18640ea60b25116407aa17354FBb) | Custom App Action |
| **Achievements ERC-1155**| `0xadb8120B4B18b892cFAD171243074487122Dea03` | Core | [View](https://basescan.org/address/0xadb8120B4B18b892cFAD171243074487122Dea03) | Custom App Badges |
| **USDC Native Base** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Token | [View](https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) | [Circle Docs](https://circle.com) |
| **WETH Base** | `0x4200000000000000000000000000000000000006` | Token | [View](https://basescan.org/address/0x4200000000000000000000000000000000000006) | [Base Docs](https://docs.base.org) |
| **cbBTC Base** | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` | Token | [View](https://basescan.org/address/0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf) | [Coinbase CDP](https://docs.cdp.coinbase.com) |
| **AERO Base** | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | Token | [View](https://basescan.org/address/0x940181a94A35A4569E4529A3CDfB74e38FD98631) | [Aerodrome Docs](https://aerodrome.finance) |
| **OpenLaunch Factory** | `0x815542E8b392389A1389E22E588E4B62A67Ade72` | Launchpad | [View](https://basescan.org/address/0x815542E8b392389A1389E22E588E4B62A67Ade72) | B20 Standard |
| **OpenLaunch Locker** | `0xcd1680D26922fcd9CabFbb8a56bA40C333fD842a` | Launchpad | [View](https://basescan.org/address/0xcd1680D26922fcd9CabFbb8a56bA40C333fD842a) | B20 Standard |
| **Coinbase Stocks (32)** | `0xb200000000000000000000...` | Equities | [View](https://basescan.org/address/0xb20000000000000000000078ee7ce2fe4908108c) | Coinbase B20 |

---

## Environment Variables

Copy `.env.example` → `.env.local`. **Never commit secrets.**

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Prod | Canonical domain URL for OG images & share links |
| `ALCHEMY_API_KEY` / `NEXT_PUBLIC_ALCHEMY_KEY` | Yes | Base RPC & wallet transaction indexing |
| `NEXT_PUBLIC_BUILDER_CODE` | Yes | Coinbase builder attribution code (`bc_4uoh9iu2`) |
| `KV_REDIS_URL` | Prod | Redis Cloud connection for token cache, leaderboard, vouchers |
| `NEXT_PUBLIC_VOUCHER_CONTRACT` | Vouchers | Deployed BaseVoucher contract address on Base |
| `NEXT_PUBLIC_PAYMASTER_URL` | Optional | Paymaster URL for gasless badge mints |
| `ZEROX_API_KEY` | Prod | 0x API key for multi-hop & USDC DEX fallback quotes |
| `BASESCAN_API_KEY` | Optional | BaseScan API key for extended transaction lookups |
| `SIWE_SESSION_SECRET` | Prod | Secret used to sign SIWE user sessions |
| `CRON_SECRET` | Prod cron | Authorization secret for `/api/cron/price-alerts` |
| `MCP_API_KEY` | Optional | Bearer auth key for protected MCP tool access |
| `X402_FACILITATOR_PRIVATE_KEY` | x402 | Facilitator key for premium scan settlement |

---

## Deploy to Vercel

1. Push `main` to GitHub (`Surya512002/Base-analytics-app`)
2. Import project in [Vercel](https://vercel.com/new)
3. Add environment variables from `.env.example` in Vercel → Settings → Environment Variables
4. Deploy — build command: `npm run build`, output: Next.js default
5. Set `NEXT_PUBLIC_APP_URL` to your production domain
6. Connect Redis (`KV_REDIS_URL`) for low-latency serverless caching

---

## Documents & In-App Help

Comprehensive documentation, interactive API tester, and FAQs:  
👉 **[base-analytics-app.vercel.app/docs](https://base-analytics-app.vercel.app/docs)**
