# Base Analytics

Gamified onchain wallet analytics on **Base** — score your wallet, mint gasless achievement badges, compete on leaderboards, pay with x402, and send **Base Voucher** crypto gift cards (ETH/USDC).

Live: [base-analytics-app.vercel.app](https://base-analytics-app.vercel.app)

## Features

- **Wallet scan** — transaction history, active days, heatmap, contract interactions (Alchemy + Blockscout + Basescan)
- **Onchain score & rank** — Shrimp → Dolphin → Shark → Whale → God
- **40+ achievement badges** — batch mint via Coinbase Paymaster (gasless)
- **Season quests & leaderboard** — weekly + global top 50
- **x402 premium scan** — pay-per-use deep analysis
- **Base Voucher** — split ETH/USDC into up to 50 gift cards with custom messages and 3D redeem reveal
- **Farcaster mini-app** — native Frames v2 integration
- **Builder attribution** — all app transactions include your Base builder code

## Tech stack

- Next.js 16, React 19, Tailwind CSS 4
- Viem, Wagmi, Coinbase OnchainKit
- Solidity (Foundry) — `BaseVoucher.sol` on Base mainnet
- Vercel KV (Redis) — leaderboard & voucher metadata
- x402 — micropayments for premium features

## Local setup

```bash
git clone https://github.com/YOUR_USERNAME/base-analytics-app.git
cd base-analytics-app
npm install
cp .env.example .env.local
# Fill in .env.local (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.example` to `.env.local`. **Never commit `.env.local`.**

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_ALCHEMY_KEY` | Yes | Alchemy Base RPC + wallet tx API |
| `NEXT_PUBLIC_BUILDER_CODE` | Yes | Coinbase builder attribution (e.g. `bc_4uoh9iu2`) |
| `NEXT_PUBLIC_VOUCHER_CONTRACT` | For vouchers | Deployed `BaseVoucher` address on Base |
| `NEXT_PUBLIC_PAYMASTER_URL` | Optional | Gas sponsorship for badge mints |
| `NEXT_PUBLIC_CDP_API_KEY` | Optional | Coinbase Developer Platform / OnchainKit analytics |
| `BASESCAN_API_KEY` | Optional | Extra tx history via Etherscan v2 API |
| `NEYNAR_API_KEY` | Optional | Farcaster analytics (server-side proxy) |
| `KV_REDIS_URL` | For prod APIs | Redis for leaderboard + voucher index |
| `X402_FACILITATOR_PRIVATE_KEY` | For x402 | Server wallet that settles premium payments |

## Scripts

```bash
npm run dev          # development server
npm run build        # production build
npm run start        # production server
npm run lint         # ESLint
npm run voucher:deploy  # deploy BaseVoucher (needs DEPLOYER_PRIVATE_KEY)
```

## Smart contracts (Base mainnet)

| Contract | Address |
|----------|---------|
| Achievements (ERC1155) | `0xadb8120B4B18b892cFAD171243074487122Dea03` |
| Booster | `0x0d1BE33F8B6a33BeEe7b3bb834DF6f8c168B2e46` |
| GM/GN | `0xdb4f873B33F448aeA8Bb2b3B7e3ab9561329608A` |
| Check-in | `0xABc7099C631E18640ea60b25116407aa17354FBb` |
| Base Voucher | Set via `NEXT_PUBLIC_VOUCHER_CONTRACT` |

## Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add all env vars from `.env.example`
4. Deploy

## Security notes

- API keys belong in `.env.local` / Vercel env — not in source code
- Neynar requests are proxied through `/api/neynar` (server-only key)
- Never commit private keys or `.env.local`

## License

MIT
