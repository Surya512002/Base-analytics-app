# Changelog — Base Terminal

All notable changes and architectural upgrades across Phases 0 through 5 are documented in this file.

---

## [BaseVoucher v2 Upgrade] Time-Locks, Expiration Reclaim, & Conditional Gift Cards

### Contract & Protocol Upgrades (`contracts/BaseVoucher.sol`)
- **Time-Lock Functionality**: Added optional `unlockTimestamp` per batch. Redemptions revert with `"Voucher is time-locked"` before unlock date.
- **Creator Reclaim of Expired Vouchers**: Added `reclaimUnredeemed(batchId)` allowing creators to safely recover unredeemed funds after `expirationTimestamp`. Sets `redeemedCount = cardCount` preventing double-reclaims.
- **Conditional Signatures / Authorized Redemptions**: Added `requiredSigner` configuration and `redeemConditional(...)` requiring an ECDSA authorization signature from the designated authority for restricted/gated rewards.
- **Full Backward Compatibility**: Preserved exact 6-tuple return signature for `getBatch(...)`, original `createEthBatch(...)`, `createUsdcBatch(...)`, `createTokenBatch(...)`, and `redeem(...)`. Added `getBatchConfig(...)`, `isBatchUnlocked(...)`, and `isBatchExpired(...)`.
- **Foundry Test Suite (`test/BaseVoucher.t.sol`)**: Added 10 new Foundry tests verifying time-lock reverts, post-unlock claims, expiration blocking, creator reclaim math, non-creator protection, and authorized ECDSA signature claims.

### Frontend, API, & MCP Integration
- **Voucher Creation Wizard (`VoucherCreateWizard.tsx`)**: Added "Time-Lock & Expiration" controls in Step 3 (Immediate, 24h, 3d, 7d unlock presets; Never, 14d, 30d, 90d expiration presets) and summary breakdown in Step 4.
- **My Cards & 1-Click Reclaim (`VoucherMyCards.tsx`)**: Added `Time-Locked` and `Expired` status badges and a 1-click `Reclaim Expired` transaction button for creators.
- **MCP Agent Tools (`app/api/mcp/route.ts` & `lib/voucher/mcp-tools.ts`)**: Added `unlock_timestamp`, `expiration_timestamp`, and `required_signer` support to `voucher_prepare_create`.
- **Claim & Redeem Panels**: Enhanced redeem preview with live onchain time-lock countdown and expiration notifications.

---

## [Phase 5] Delivery & Release Hardening

### Core Highlights & Polish
- **Full Build & Verification Passes**: All 24 static and dynamic App Router routes compiled cleanly.
- **Documentation**: Updated `README.md` and added comprehensive `CHANGELOG.md` covering all architectural enhancements and manual verification procedures.
- **Zero New Env Vars Required**: All new capabilities (Token X-Ray, Swap Preview, Smart Money Radar, Portfolio Time Machine, MCP tools) reuse existing Base RPCs and APIs without requiring paid external services.

---

## [Phase 4] Security & Reliability Hardening

### Changes
- **Exact Token Approvals**: Replaced all `maxUint256` blanket allowances across `DexSwapCard.tsx`, `useWalletApp.ts`, and `useVoucherTab.ts` with exact amounts required for the active trade or deposit.
- **Fee Logic Auditing**: Verified 25 bps general DEX trading fee vs 50 bps (0.25% creator revenue share + 0.25% platform share) on platform-launched tokens.
- **API Outage Retries & Backoff**: Added retry and exponential backoff wrappers to DexScreener batch queries and Neynar Farcaster lookups.
- **Secrets Hygiene**: Verified 0 raw private keys or secrets exposed in working tree.
- **Playwright Core Flows**: Added `e2e/core-flows.spec.ts` testing wallet connect modal, swap card with Advanced accordion, voucher create/redeem navigation, and launchpad configuration.

---

## [Phase 3] Differentiating Features

### Changes
- **Token X-Ray (0–100 Safety Score)**:
  - Added `lib/launchpad/token-xray.ts` and `app/api/launchpad/xray/route.ts`.
  - Evaluates LP lock/reserves (0-25 pts), holder concentration (0-25 pts), contract privileges/mint logic (0-25 pts), and honeypot/sell taxes (0-25 pts).
  - Added interactive `TokenXRayBadge.tsx` to `TokenCard.tsx` and `DexSwapCard.tsx`.
- **Swap Preview Modal**:
  - Added `components/swap/SwapPreviewModal.tsx`.
  - Shows plain-English breakdown of You Pay, You Receive, Base Gas (~$0.001), Platform Fees, Price Impact, and Route Risks before wallet signature.
- **Wallet DNA Card**:
  - Added `components/profile/WalletDnaCard.tsx` generating dynamic OG images (`/api/og`) with live Base Activity Score, active days, transactions, and Neynar Farcaster identity.
  - Added 1-click sharing to Warpcast and X (Twitter).
- **Smart Money Radar**:
  - Added `lib/smart-money/smart-money-store.ts`, `app/api/smart-money/route.ts`, and `components/explore/SmartMoneyRadar.tsx`.
  - Tracks top Base whale addresses and real-time token purchases with 1-click copy-trade link to Swap.
- **Portfolio Time Machine**:
  - Added `components/portfolio/PortfolioTimeMachine.tsx` into `HoldingsDrawer.tsx`.
  - Interactive lookback slider (7d to 365d) displaying past valuation drift and net PnL with CSV export.
- **Launch Readiness Score**:
  - Enhanced `components/launchpad/LaunchConfigSummary.tsx` with a 0–100 readiness score, allocations checklist, vesting timeline, and anti-snipe MEV dampening preview.
- **Agent-Native MCP Tools**:
  - Added `token_xray`, `swap_preview`, and `wallet_dna` to `app/api/mcp/route.ts` enabling autonomous AI agents (Claude, Cursor, GPTs) to utilize terminal intelligence.

---

## [Phase 2] UI/UX & Flow Simplification

### Changes
- **Simplified Swap Card**: Consolidated slippage presets/custom, DEX routing overrides, price impact, and fee breakdown into a single, clean "Advanced" collapsible accordion.
- **Command Palette Intent Bar**: Extended `⌘K` spotlight with natural-language intent parser (`lib/intent/intent-parser.ts`): `"swap 50 USDC to ETH"`, `"gift 10 USDC"`, `"launch token"`, `"stake usdc"` pre-fills the terminal.
- **Skeleton, Empty & Error States**: Standardized across Explore, Swap, Lend, Vouchers, Launch, and Profile.
- **Accessible Hover Pop**: Configured `--pop-lift: -5px`, `--pop-scale: 1.03`, and 220ms ease with `@media (hover: hover) and (pointer: fine)` and full `@media (prefers-reduced-motion: reduce)` compliance.

---

## [Phase 1] Bug Fixes & Responsive Testing

### Changes
- **Deterministic Swap Tab Ingestion**: Fixed URL param re-renders in `components/swap/SwapTab.tsx` with `lastIngestedKeyRef`, preventing user token selections from being overwritten.
- **Portfolio Indexer Accuracy**: Verified portfolio client against Coinbase Wallet and onchain data, resolving Blockscout v2 `{ items: [...] }` parsing and adding regression tests.
- **Mobile Responsive Layout**: Resolved text overflows at 320px/375px/390px in `StockQuotePicker.tsx` and added safe-area padding `env(safe-area-inset-bottom)` to `AppFooterNav.tsx`.

---

## [Phase 0] Health & Decoupling

### Changes
- **Local Font Integration**: Decoupled from Google Fonts CDN by self-hosting `Figtree` and `Syne` latin fonts locally via `next/font/local`.
- **OnchainKit Decoupling**: Replaced deprecated `@coinbase/onchainkit` transaction types with native interfaces.
- **React 19 Rules**: Resolved ref-during-render and immutability violations in `useVoucherTab.ts`, `useWalletApp.ts`, and `LaunchpadTab.tsx`.
- **ESLint Warning Reduction**: Reduced warnings from ~437 down to 248.
