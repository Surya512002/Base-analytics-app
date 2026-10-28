# Base Terminal

[![Base Mainnet](https://img.shields.io/badge/Base_Mainnet-Chain_ID_8453-0052FF?logo=coinbase&logoColor=white)](https://base.org)
[![Next.js](https://img.shields.io/badge/Next.js-16_App_Router-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![Tests](https://img.shields.io/badge/Tests-43_Suites_|_269_Passed-brightgreen)](test/)
[![Security Policy](https://img.shields.io/badge/Security-Policy_&_Audit-blue)](SECURITY.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](MITLICENCE)

High-performance trading terminal, tokenized equity discovery, lending comparisons, and token launchpad on **Base Mainnet** — trade tokenized equities, swap tokens with multi-DEX smart routing, compare lending and borrow yields, launch meme and stock-paired tokens with creator revenue sharing, and send **Base Voucher** crypto gift cards.

**Live Terminal:** [base-analytics-app.vercel.app](https://base-analytics-app.vercel.app)  
**Developer Documentation & API Tester:** [base-analytics-app.vercel.app/docs](https://base-analytics-app.vercel.app/docs)  
**Restricted Regions & Gating Policy:** [base-analytics-app.vercel.app/restricted-regions](https://base-analytics-app.vercel.app/restricted-regions)

---

## What Users Get

| Section | Key Highlights |
| :--- | :--- |
| **Explore** | Token discovery across 32 Coinbase tokenized equities (MSFTc, AAPLc, NVDAc, TSLAc, GOOGLc, METAc, COINc, AMZNc, etc.), 24h volume, interactive charts, and push price alerts. |
| **Swap** | Smart multi-DEX routing across Uniswap v3, Aerodrome, Slipstream, 0x API v2, and o1 quote routing with built-in **0.25% creator revenue fee sharing** and transparent 0.50% platform fee. |
| **Launchpad** | 3 token launch modes: **B20 vanity tokens** (0xB200... mining), **ERC-20 meme coins**, and **stock-paired memestocks** (paired with NVDAc or AAPLc) with anti-snipe protection, trademark collision warnings, and vesting. |
| **Lend & Stake** | Real-time yield comparisons across Morpho Blue, Aave v3, Moonwell, and Superform vaults with interactive **Collateral Health Factor Simulator** and borrow risk disclosures. |
| **Base Voucher** | Decentralized crypto gift cards: split deposits into up to 50 cards supporting **ETH, USDC, Tokenized Stocks**, and **Morpho/Superform Yield Vault shares** (`mvNVDAc`, `mvAAPLc`, `sfNVDAc`, `mvCOINc`). |
| **Compliance Safeguards** | Configurable product guardrails: Edge geo-gating, **Exit-Only Mode** (users are never locked out of their funds), first-use risk acknowledgement modal, and remote kill switch. |
| **AI Agents & MCP** | Official **Model Context Protocol (MCP)** server at `/api/mcp` enabling autonomous AI agents (Claude Desktop, Cursor, OpenAI GPTs) to prepare batches, query live statuses, and claim vouchers. |
| **Creator Hub** | Onchain creator profiles (`/creator/[address]`), volume attribution, fee earnings, and verified Coinbase Builder Code attribution (`bc_4uoh9iu2`). |
| **Wallet Analytics** | Base Activity Score (0–100), ERC-4337 smart account user ops, ERC-1155 achievements, daily check-in streaks, and Hall of Fame. |

> [!TIP]
> Guests can freely browse **[/explore](https://base-analytics-app.vercel.app/explore)** and **[/lend](https://base-analytics-app.vercel.app/lend)** without connecting a wallet.

---

## Product Safeguards & Exit-Only Architecture

All compliance guardrails in Base Terminal are **product safeguards pending formal legal counsel review**, not legal advice. The application strictly avoids claiming to be "compliant" or government-endorsed.

```
                          Incoming Request at Edge
                                     │
                     ┌───────────────▼───────────────┐
                     │     Next.js Edge Middleware   │
                     │     (reads x-vercel-ip-country)│
                     └───────────────┬───────────────┘
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         ▼                                                       ▼
   Restricted Region (or Kill Switch)                     Unrestricted Region
         │                                                       │
 ┌───────▼───────────────────────────┐                   ┌───────▼───────────────────┐
 │ EXIT-ONLY MODE ACTIVE             │                   │ FULL ACCESS               │
 │ • Buy Stocks / Supply: BLOCKED    │                   │ • First-use risk modal ack│
 │ • Borrow / Launch:     BLOCKED    │                   │ • All trading, lending,   │
 │ • Withdraw Collateral: PERMITTED  │                   │   and vouchers functional │
 │ • Repay Debt:          PERMITTED  │                   └───────────────────────────┘
 │ • Sell Stocks to USDC: PERMITTED  │
 │ • Redeem Vouchers:     PERMITTED  │
 └───────────────────────────────────┘
```

- **Exit-Only Guarantee**: Users in restricted jurisdictions or under administrative safety pauses are **never blocked from accessing their own funds**. Withdrawals, repayments, unstaking, selling stock tokens to USDC/ETH, and voucher redemptions remain accessible.
- **First-Use Risk Modal**: Displays volatility, 24/5 equity vs 24/7 AMM price staleness, and links to issuer terms. Stores versioned acceptance in local storage without server PII collection.
- **Detailed References**:
  - Full architectural documentation: [`COMPLIANCE.md`](COMPLIANCE.md)
  - Copy review & promotional claims audit: [`COPY_REVIEW.md`](COPY_REVIEW.md)
  - Security architecture: [`SECURITY.md`](SECURITY.md)

---

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5
- **Styling:** Vanilla CSS & Tailwind CSS 4, CSS Design Tokens (Blue Hour Meridian / Paylane system)
- **Web3 & Onchain:** Viem 2, Wagmi 2, Coinbase OnchainKit, Farcaster Mini-App SDK
- **Data & Caching:** Redis (`KV_REDIS_URL`) — token cache, voucher index, creator stats
- **DEX Aggregation:** Uniswap v3 Quoter/Router, Aerodrome Router & Slipstream, 0x Swap API v2, o1 trading
- **Autonomous Agents:** Model Context Protocol SDK (`@modelcontextprotocol/sdk`)
- **Smart Contracts & Testing:** Foundry (`contracts/BaseVoucher.sol`), Vitest 4, Playwright

---

## Public REST API Endpoints

All endpoints are publicly accessible from `https://base-analytics-app.vercel.app`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/compliance/status` | Server-verified regional compliance status, kill switch, and active feature flags |
| `GET` | `/api/stocks` | Real-time Coinbase tokenized stocks feed, prices, 24h volume, NAV, and filters |
| `GET` | `/api/markets/lending` | Lending & borrow yields across Morpho Blue, Aave v3, and Superform |
| `GET` | `/api/launchpad/market` | Terminal-wide launchpad volume, market cap, and active tokens |
| `GET` | `/api/launchpad/tokens` | Paginated index of launched tokens with search and creator filter |
| `GET` | `/api/launchpad/quote` | Smart multi-DEX swap quotes with creator fee split, price impact, and geo-gating |
| `GET` | `/api/launchpad/activity` | Live stream of token deployments, buys, sells, and liquidity events |
| `GET` | `/api/launchpad/holders` | Token holder distribution analysis and concentration metrics |
| `GET` | `/api/launchpad/calendar` | Scheduled token launch drops and mint calendar |
| `GET` | `/api/voucher/card-preview`| Public gift card metadata lookup by Card ID (`batchId-cardIndex`) |
| `POST` | `/api/voucher/prepare-create`| Prepare unsigned voucher batch creation calldata (enforces region checks) |
| `POST` | `/api/voucher/prepare-redeem`| Prepare unsigned voucher claim calldata (unrestricted exit-only access) |
| `POST` | `/api/mcp` | Model Context Protocol JSON-RPC server for autonomous AI agents |
| `GET` | `/api/creator/[address]` | Creator analytics, launched tokens, lifetime volume, and fee earnings |
| `GET` | `/api/health` | Service health, Redis connectivity, and RPC latency check |

Interactive documentation and cURL code generators: **[/docs](https://base-analytics-app.vercel.app/docs)**.

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
| :--- | :--- | :--- |
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

## Available Scripts & Verification Suite

Run the full pre-flight verification with a single command:
```bash
npm run verify                  # One command: typecheck + lint + audit + secrets + tests + fork
```

### Individual Quality & Security Commands

```bash
# Code Quality & Static Analysis
npm ci                          # Clean dependency installation
npm run typecheck               # Run TypeScript compiler checks (0 errors)
npm run lint                    # Run ESLint validation (0 errors)
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

# Mainnet Fork & App Tests
npm run test:fork               # Run on-chain tests against Base mainnet fork / RPC
npm test                        # Run all Vitest unit and integration suites (43 files, 269 tests)
npm run test:e2e                # Run Playwright end-to-end browser tests
```

---

## Contract Address Registry (Base Mainnet — Chain ID: 8453)

All contract addresses are strictly centralized and checksummed in [`lib/contracts/registry.ts`](lib/contracts/registry.ts):

| Contract Name | Address | Category | Basescan | Verified Source |
| :--- | :--- | :--- | :--- | :--- |
| **Morpho Blue Singleton** | `0xBBBBBbbBBb9cC5e90e3b3Af62C37EEFFCb` | Protocol | [View](https://basescan.org/address/0xBBBBBbbBBb9cC5e90e3b3Af62C37EEFFCb) | [Morpho Docs](https://docs.morpho.org) |
| **Aave V3 Pool Base** | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` | Protocol | [View](https://basescan.org/address/0xA238Dd80C259a72e81d7e4664a9801593F98d1c5) | [Aave Docs](https://docs.aave.com) |
| **Moonwell Comptroller** | `0xFBB21d0380BEE3312b33c4353C793670a1640428` | Protocol | [View](https://basescan.org/address/0xFBB21d0380BEE3312b33c4353C793670a1640428) | [Moonwell Docs](https://docs.moonwell.fi) |
| **Aerodrome Router** | `0xcF77A3ba9A5ca399B7c97c748846942438557642` | Protocol | [View](https://basescan.org/address/0xcF77A3ba9A5ca399B7c97c748846942438557642) | [Aerodrome Docs](https://aerodrome.finance) |
| **Aerodrome Slipstream** | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` | Protocol | [View](https://basescan.org/address/0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5) | [Aerodrome Docs](https://aerodrome.finance) |
| **Platform Treasury** | `0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F` | Core | [View](https://basescan.org/address/0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F) | Safe Multisig |
| **USDC Native Base** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Token | [View](https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) | [Circle Docs](https://circle.com) |
| **WETH Base** | `0x4200000000000000000000000000000000000006` | Token | [View](https://basescan.org/address/0x4200000000000000000000000000000000000006) | [Base Docs](https://docs.base.org) |
| **cbBTC Base** | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` | Token | [View](https://basescan.org/address/0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf) | [Coinbase CDP](https://docs.cdp.coinbase.com) |
| **Coinbase Stocks (32)** | `0xb200000000000000000000...` | Equities | [View](https://basescan.org/address/0xb20000000000000000000078ee7ce2fe4908108c) | Coinbase B20 |

---

## Security & Responsible Disclosure

We enforce strict non-custodial principles, pre-execution transaction simulations, exact token approvals, and zero private key or PII storage.

To report a vulnerability responsibly, please refer to our **[Security Policy](SECURITY.md)** or open a private advisory via [GitHub Security Advisories](https://github.com/Surya512002/Base-analytics-app/security/advisories/new).

---

## License

This project is open-source software licensed under the **[MIT License](MITLICENCE)** (see also [`LICENSE`](LICENSE)).

Copyright (c) 2026 Surya / Base Analytics App Contributors.
