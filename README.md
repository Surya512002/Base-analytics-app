# Base Analytics

Gamified onchain wallet analytics on **Base** — explore & swap tokens, score your wallet, earn quest XP, mint badges, and send **Base Voucher** crypto gift cards.

**Live:** [base-analytics-app.vercel.app](https://base-analytics-app.vercel.app)

## What users get

| Section | Highlights |
|---------|------------|
| **Explore** | B20 launchpad, token search, trending rails, in-app swaps (Uniswap + Aerodrome), watchlist & price alerts |
| **Analytics** | Onchain score, heatmap, improvement tips, challenge links, shareable profile |
| **Quests** | Daily check-in, weekly quests, XP leaderboard, optional on-chain stake |
| **Vouchers** | Split ETH/USDC into gift cards, redeem deep links, creator batch analytics |
| **Badges** | 40+ achievement NFTs, gasless mints via Paymaster when configured |

Guests can browse **[/explore](https://base-analytics-app.vercel.app/explore)** without connecting.

## Tech stack

- Next.js 16, React 19, Tailwind CSS 4
- Viem, Wagmi, Coinbase OnchainKit
- Redis (`KV_REDIS_URL`) — leaderboard, wallet cache, voucher index
- x402 — micropayments for premium wallet scan
- Foundry — `BaseVoucher.sol`, optional `XpStake` / `BadgeMarketplace`

## Local setup

```bash
git clone https://github.com/Surya512002/Base-analytics-app.git
cd Base-analytics-app
npm install
cp .env.example .env.local
# Fill in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev          # development
npm run build        # production build
npm run start        # production server
npm run typecheck    # TypeScript
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright smoke + mobile flows
npm run test:swap-routes        # Quote API smoke (production URL)
npm run test:swap-routes:local  # Quote API against localhost:3000
npm run lint         # ESLint
```

## Environment variables

Copy `.env.example` → `.env.local`. **Never commit secrets.**

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Prod | Canonical URL for OG + share links |
| `ALCHEMY_API_KEY` / `NEXT_PUBLIC_ALCHEMY_KEY` | Yes | Base RPC + wallet indexing |
| `NEXT_PUBLIC_BUILDER_CODE` | Yes | Coinbase builder attribution |
| `KV_REDIS_URL` | Prod | Redis for cache, leaderboard, vouchers |
| `NEXT_PUBLIC_VOUCHER_CONTRACT` | Vouchers | Deployed BaseVoucher on Base |
| `NEXT_PUBLIC_PAYMASTER_URL` | Optional | Gasless badge mints |
| `BASESCAN_API_KEY` | Optional | Extra tx history |
| `ZEROX_API_KEY` | Prod | 0x aggregator fallback for USDC / multi-hop swaps |
| `BASE_DASHBOARD_API_KEY` | Optional | Base App push notifications |
| `CRON_SECRET` | Prod cron | Auth for `/api/cron/price-alerts` |
| `MCP_API_KEY` | Optional | Auth for `/api/mcp` agent tools |
| `X402_FACILITATOR_PRIVATE_KEY` | x402 | Premium scan settlement |
| `NEXT_PUBLIC_XP_STAKE_CONTRACT` | Optional | On-chain XP stake |
| `NEXT_PUBLIC_BADGE_MARKETPLACE_CONTRACT` | Optional | On-chain badge listings |

## Deploy to Vercel

1. Push `main` to GitHub (`Surya512002/Base-analytics-app`)
2. [Import project](https://vercel.com/new) → select repo
3. Add **all** env vars from `.env.example` in Vercel → Settings → Environment Variables
4. Deploy — build command: `npm run build`, output: Next.js default
5. Set `NEXT_PUBLIC_APP_URL` to your production domain
6. Add Redis (`KV_REDIS_URL`) — **required** for fast wallet reconnects on serverless

`vercel.json` sets 120s timeout on heavy wallet API routes.

### Post-deploy checklist

- [ ] `/api/health` returns `{ ok: true }`
- [ ] `/explore` loads as guest
- [ ] Connect wallet → score appears on Analytics tab
- [ ] Voucher create/redeem (if contract set)
- [ ] Update `public/.well-known/farcaster.json` if mini-app URL changes

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on push: `typecheck` → `test` → `lint` → `build`.

## Smart contracts (Base mainnet)

| Contract | Address |
|----------|---------|
| Achievements (ERC1155) | `0xadb8120B4B18b892cFAD171243074487122Dea03` |
| Check-in | `0xABc7099C631E18640ea60b25116407aa17354FBb` |
| Base Voucher | `NEXT_PUBLIC_VOUCHER_CONTRACT` |

## Help

In-app FAQ: [/help](https://base-analytics-app.vercel.app/help)
