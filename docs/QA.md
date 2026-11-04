# Feature Verification Matrix

This matrix documents the functional, automated test, and audit status of all major subsystems in the Base Terminal / Base Analytics platform as of the `futuristic-v2` branch.

| Subsystem | Feature | Status | Test / Verification Evidence | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Explore** | Token Directory & Safety Badges | **Working** | `test/compliance/trademark-check.test.ts`, `test/ui/token-logo.test.ts`, `e2e/core-flows.spec.ts` | Filter by verified, meme, stock; search by symbol/address. |
| **Swap** | DEX Swapping & URL Ingestion | **Working** | `test/swap/swap-link.test.ts`, `test/swap/verified-tokens.test.ts`, `lib/launchpad/price-impact.test.ts` | Ingests URL parameters once via `lastIngestedKeyRef`; no overwrite on re-render. |
| **Lend & Stake** | APY Yield Calculator & Explore Vault | **Working** | `test/lending/yield-calculator-action.test.ts`, `test/lending/live-sync.test.ts`, `e2e/core-flows.spec.ts` | Instant modal routing without guest-mode blocking; real onchain APYs; eliminated hardcoded 290.2% APR fallback. |
| **Lend & Stake** | Stock Lending Comparison & Staking Gauges | **Working** | `test/lending/protocol-comparison-hub.test.ts`, `lib/lending/action-drawer.test.ts` | Real onchain integration with Beefy, Aerodrome, Morpho Blue, and Moonwell. |
| **Base Vouchers** | Time-locked Vouchers & Creator Reclaim | **Working** | `lib/voucher/claim-link-parser.test.ts`, `lib/voucher/confirm-create.test.ts` | Base Builder attributed voucher issuance, conditional signatures, and redemption. |
| **Token Launch** | Fixed Supply & B20 Launcher | **Working** | `test/launchpad/launch-math.test.ts`, `lib/launchpad/token-launch-fees.test.ts`, `lib/b20/launch-smoke.test.ts` | Multi-step launch wizard with liquidity pool configuration, anti-snipe options, and fee validation. |
| **Profile** | Verified Onchain Activity (Wallet DNA) | **Working** | `lib/wallet/merge-partial-sync.test.ts`, `test/portfolio/portfolio-client.test.ts` | Factual activity display (streak, active days, DEX volume) with zero synthetic 0–100 scores or ranks. |
| **Onchain Actions** | Daily Check-In, GM/GN, and Boost | **Working** | `lib/utils/check-in-rewards.test.ts`, `lib/utils/tx-builder-attribution.test.ts` | Plain onchain contract actions with verified streak tracking; zero XP or points inflation. |
| **Price Alerts** | Automated Price Tracking & Webhook Alerts | **Working** | `app/api/cron/price-alerts/route.ts`, `lib/api/rate-limit.test.ts` | Automated cron job monitoring Base price feeds and dispatching alerts. |
| **Intent Bar** | Command Palette & Natural Language Routing | **Working** | `test/intent/intent-parser.test.ts` | Parses user intents ("swap 50 USDC to ETH", "launch token") and pre-fills target action flows. |
| **Farcaster** | Mini App & SIWE Authentication | **Working** | `lib/auth/siwe-server.test.ts`, `lib/auth/farcaster-siwe-server.test.ts` | Farcaster frame and native SIWE cryptographic session authorization. |
| **MCP Server** | Onchain Tools API | **Working** | `app/api/mcp/route.ts` | JSON-RPC 2.0 tools for token xray, voucher create/claim, swap quoting, and wallet activity. |
| **Lend & Stake** | Liquidation Guard & Stress Test | **Working** | `test/lending/liquidation-guard.test.ts`, `e2e/core-flows.spec.ts` | Real onchain distance-to-liquidation gauge, What-If collateral drop slider, and browser push alerts. |
| **Explore** | Smart Money Radar & Inflows | **Working** | `test/explore/smart-money.test.ts`, `e2e/core-flows.spec.ts` | Live Base whale inflow stream, wallet follower, copy-trade action, zero mock data. |
| **Portfolio** | Portfolio Time Machine & Tax CSV | **Working** | `test/portfolio/time-machine.test.ts`, `e2e/core-flows.spec.ts` | Multi-horizon historical net worth (7d/30d/90d/1y), What-If-Held-ETH benchmark, and tax-friendly CSV export. |
| **Lend & Stake** | Yield Finder Multi-Protocol Scanner | **Working** | `test/lending/yield-finder.test.ts`, `e2e/core-flows.spec.ts` | Filter and rank Aerodrome, Beefy, Morpho, and Moonwell pools by net APY, TVL, and risk tier. |
| **Stocks** | Stock NAV Tracker & Market Hours | **Working** | `test/stocks/nav-tracker.test.ts`, `e2e/core-flows.spec.ts` | 24/5 official custodian NAV vs 24/7 DEX AMM spread, market hours indicator, custody attestations. |
| **Alerts** | Smarter Alerts & Webhooks | **Working** | `test/alerts/smarter-alerts.test.ts`, `e2e/core-flows.spec.ts` | Multi-trigger monitoring: whale swaps (> $25k), yield spikes (> 5%), liquidity drops (> 15%), and webhooks. |
| **Launchpad** | Launch Readiness Simulator | **Working** | `test/launchpad/readiness-simulator.test.ts` | 4-pillar pre-flight scoring (liquidity, LP lock, anti-snipe, supply) with fair launch recommendations. |
| **MCP Server** | Extended Read-Only Tools | **Working** | `test/mcp/tools.test.ts`, `app/api/mcp/route.ts` | Exposes `token_xray`, `swap_preview`, `yield_finder`, and `liquidation_status` JSON-RPC tools. |
| **Vouchers** | Gift Capsules & Interactive 3D Unwrap | **Working** | `test/voucher/gift-capsules.test.ts`, `components/wallet/VoucherRedeemReveal.tsx` | 3D gift unwrap animation, secret message verification, and Warpcast/X social share cards. |
