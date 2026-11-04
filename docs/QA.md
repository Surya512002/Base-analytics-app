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
