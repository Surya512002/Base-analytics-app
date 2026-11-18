# Base Analytics

[![CI](https://github.com/Surya512002/Base-analytics-app/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Surya512002/Base-analytics-app/actions/workflows/ci.yml)
[![Base Mainnet](https://img.shields.io/badge/Base-Mainnet_·_8453-0052FF?logo=coinbase&logoColor=white)](https://base.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![Security](https://img.shields.io/badge/Security-Audit_2026--11-blue)](docs/security/AUDIT-2026-11-17.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Tokenized stocks on Base, made simple.** Discover Coinbase tokenized stocks, swap any token in
one tap, earn yield on stock/USDC pools without holding both tokens, launch your own token with
creator revenue, and send crypto gift cards, all in one non-custodial app on **Base mainnet**.

**Live app:** [baseanalytics.app](https://baseanalytics.app) ·
**Docs & API tester:** [/docs](https://baseanalytics.app/docs) ·
**Restricted regions:** [/restricted-regions](https://baseanalytics.app/restricted-regions)

---

## What's inside

| Section | What you can do |
| :--- | :--- |
| **Explore** | Browse 350+ Coinbase tokenized stocks (NVDAc, AAPLc, MSFTc, TSLAc, GOOGLc, METAc, AMZNc…) and Base tokens with live prices, market signals and key movers, a live market map, **Token X-Ray** safety scores and price alerts. |
| **Swap** | Best-route quotes across Base DEXs (Uniswap v3, Aerodrome, Slipstream) and the 0x aggregator, a clear preview before you sign, price-impact guards and a **0.25% fee**. Browser wallets get the whole swap as one atomic transaction. |
| **Lend & Stake** | Verified stock markets across Morpho, Beefy, Aerodrome, Aave and Moonwell. **Smart Deposit** puts USDC, ETH or a stock into stock/USDC vaults in one step: no need to hold both tokens. Includes positions, a liquidation guard, Yield Finder and protocol comparison. |
| **Vouchers** | Onchain gift cards in **ETH, USDC, tokenized stocks or vault shares**. Split one deposit into up to 50 cards or one shareable link; unclaimed gifts return to you. |
| **Launch** | Launch **B20 vanity tokens**, ERC-20 meme coins or stock-paired tokens. $0 platform fee, creators earn a share of every swap, with a readiness score and anti-snipe protection. |
| **Profile** | Your creator page: launched tokens, swap-fee revenue, vesting, a **Community Pulse** of daily users, and wallet analytics. |
| **AI agents (MCP)** | A public Model Context Protocol server at `/api/mcp` with 9 tools (see below). |

> [!TIP]
> Guests can browse **[Explore](https://baseanalytics.app/explore)** and
> **[Lend & Stake](https://baseanalytics.app/lend)** without connecting a wallet.

---

## How transactions work (and stay safe)

- **Non-custodial.** The app never holds your funds or keys; every action is a transaction you sign.
- **Simulated before you sign.** Multi-step actions are dry-run against the chain first, so a step
  that would fail is caught before your wallet opens.
- **Exact approvals only.** Never unlimited, and no allowance is left behind after a flow.
- **Atomic Smart Deposit / Withdraw.** Pair-vault deposits run through Beefy's audited Zap Router on
  Base: at most one exact approval plus one transaction that swaps, adds liquidity and stakes,
  with on-chain minimums. It either completes or nothing changes.

  | Flow | Before | Now |
  | :--- | :--- | :--- |
  | Vault deposit with USDC | 4 transactions | **2** (1 exact approval) |
  | Vault deposit with ETH | 5 transactions | **1** (no approval) |
  | Swap with USDC (browser wallet) | up to 6 prompts | **2** |
  | Swap with ETH (browser wallet) | 2–4 prompts | **1** |

- **Smart wallets** (Coinbase Smart Wallet, Base Account, Farcaster) sign a whole batch at once.
- **Base builder code** is attached to every app transaction.

---

## Product safeguards & exit-only mode

These are product safeguards pending legal review, not legal advice; the app does not claim to be
"compliant" or endorsed by any regulator.

```
                    Request at the edge (Next.js middleware)
                    country = x-vercel-ip-country (platform-set,
                    client headers ignored in production)
                                   │
           ┌───────────────────────┴───────────────────────┐
           ▼                                               ▼
  Restricted region / kill switch                  Unrestricted region
  EXIT-ONLY MODE                                   FULL ACCESS
  • Buy stocks / supply / borrow / launch: blocked • First-use risk acknowledgement
  • Withdraw, repay, sell to USDC: allowed         • All features available
  • Redeem vouchers: allowed
```

- **Exit-only guarantee:** users are never locked out of their own funds.
- More detail: [`COMPLIANCE.md`](COMPLIANCE.md) · [`COPY_REVIEW.md`](COPY_REVIEW.md) · [`SECURITY.md`](SECURITY.md)

---

## Tech stack

- **App:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Motion
- **Onchain:** viem 2, wagmi 2, Coinbase OnchainKit, Base Account, Farcaster Mini App SDK
- **Routing & DeFi:** Uniswap v3, Aerodrome & Slipstream, 0x Swap API, Beefy CLM vaults + Zap Router, Morpho Blue, Aave, Moonwell
- **Data:** Redis (cache, voucher index, creator stats); a Go collector built at deploy time
- **AI agents:** Model Context Protocol SDK
- **Contracts & tests:** Foundry (Solidity), Vitest (unit, integration, mainnet-fork), Playwright (desktop + mobile e2e)
- **Hosting:** Vercel

---

## Public API

All endpoints are served from `https://baseanalytics.app`. Try them live at **[/docs](https://baseanalytics.app/docs)**.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/stocks` | Tokenized stocks feed: prices, 24h volume, NAV |
| `GET` | `/api/markets/lending` | Verified lending / borrow / LP markets and yields |
| `GET` | `/api/launchpad/quote` | Multi-DEX swap quote with fee split and price impact |
| `GET` | `/api/launchpad/market` · `/tokens` · `/activity` · `/holders` · `/calendar` | Launchpad market data |
| `GET` | `/api/creator/[address]/profile` | Creator profile and launched tokens |
| `GET` | `/api/voucher/card-preview` | Public gift-card lookup by card ID |
| `POST` | `/api/voucher/prepare-create` · `/prepare-redeem` | Unsigned voucher calldata (region-checked; redeem always allowed) |
| `GET` | `/api/compliance/status` | Your region's access mode and feature flags |
| `GET` | `/api/health` | Service, Redis and RPC health |
| `POST` | `/api/mcp` | MCP JSON-RPC server for AI agents |

---

## MCP server for AI agents

Remote MCP endpoint: `https://baseanalytics.app/api/mcp`

```bash
# Claude Code
claude mcp add --transport http base-analytics https://baseanalytics.app/api/mcp
```

```json
// Cursor / Claude Desktop: mcpServers
{ "mcpServers": { "baseAnalytics": { "url": "https://baseanalytics.app/api/mcp" } } }
```

| Tool | What it does |
| :--- | :--- |
| `token_xray` | Safety score (0–100) and risk checks for a Base token |
| `swap_preview` | Quote, route, fees and price impact for a swap |
| `yield_finder` | Best verified yields for an asset |
| `liquidation_status` | Health factor and liquidation risk for a wallet |
| `wallet_dna` | Wallet profile and activity summary |
| `voucher_prepare_create` / `voucher_prepare_redeem` | Unsigned gift-card create / claim calldata |
| `voucher_lookup_batch` / `voucher_list_by_creator` | Live gift-card batch status |

---

## Contracts (Base mainnet, chain 8453)

All addresses are centralized and checksummed in [`lib/contracts/registry.ts`](lib/contracts/registry.ts).

| Contract | Address |
| :--- | :--- |
| Base Voucher protocol | set via `NEXT_PUBLIC_VOUCHER_CONTRACT` |
| Platform treasury | [`0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F`](https://basescan.org/address/0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F) |
| Beefy Zap Router (Smart Deposit) | [`0x6F19Da51d488926C007B9eBaa5968291a2eC6a63`](https://basescan.org/address/0x6F19Da51d488926C007B9eBaa5968291a2eC6a63) |
| Morpho Blue | [`0xBBBBBbbBBb9cC5e90e3b3Af62C37EEFFCb`](https://basescan.org/address/0xBBBBBbbBBb9cC5e90e3b3Af62C37EEFFCb) |
| Aerodrome Router | [`0xcF77A3ba9A5ca399B7c97c748846942438557642`](https://basescan.org/address/0xcF77A3ba9A5ca399B7c97c748846942438557642) |
| USDC | [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) |
| WETH | [`0x4200000000000000000000000000000000000006`](https://basescan.org/address/0x4200000000000000000000000000000000000006) |
| Coinbase tokenized stocks | `0xb2000000…` (B20), e.g. [NVDAc](https://basescan.org/address/0xb20000000000000000000078ee7ce2fe4908108c) |
| Builder code | `bc_4uoh9iu2` |

---

## Run it locally

Requires **Node 24** (see [`.nvmrc`](.nvmrc)) and Go (for the collector build).

```bash
git clone https://github.com/Surya512002/Base-analytics-app.git
cd Base-analytics-app
npm install
cp .env.example .env.local   # fill in your own values; never commit .env.local
npm run dev                  # http://localhost:3000
```

### Checks

```bash
npm run verify       # typecheck + lint + audit + secret scan + unit tests + fork tests
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # Vitest unit & integration suites
npm run test:e2e     # Playwright (desktop + mobile)
npm run build        # production build (collector + Next.js)
npm run secrets:scan # scan files and git history for leaked keys
forge test -vvv      # Solidity tests (Foundry)
```

Mainnet transaction simulations used in the security audit (nothing is signed or sent) live in
[`scripts/audit/`](scripts/audit/).

---

## Contributing

`main` is protected: every change goes through a pull request, and it can only merge when all
required checks pass:

- **Code Quality & App Tests:** typecheck, lint, unit tests, dependency audit, build, e2e
- **Gitleaks Secrets Detection:** no keys or secrets in code or history
- **Smart Contracts & Security Analysis:** Foundry build/tests and Slither
- **Vercel**

Dependabot opens weekly update PRs for npm packages and GitHub Actions; actions are pinned to
commit SHAs.

---

## Pro Orders (beta, testnet only)

Limit, take-profit, stop-loss, trailing-stop, bracket and recurring (DCA) orders for tokenized
stocks, executed by an open-source keeper. **Base Sepolia only with mock tokens; not audited and
not deployed to mainnet.** Hidden in production unless `NEXT_PUBLIC_LIMIT_ORDERS_ENABLED="true"`.
Setup, keeper and testnet guide: [`limit-orders/README.md`](limit-orders/README.md).

---

## Security

Non-custodial by design, with pre-signing simulation, exact approvals and no private keys or PII
stored. Latest review: [Security & transaction audit, Nov 2026](docs/security/AUDIT-2026-11-17.md).

Report a vulnerability privately via
[GitHub Security Advisories](https://github.com/Surya512002/Base-analytics-app/security/advisories/new)
or see [`SECURITY.md`](SECURITY.md).

---

## License

MIT. See [`LICENSE`](LICENSE). Copyright (c) 2026 Surya / Base Analytics contributors.
