# Base Terminal / Base Analytics — Comprehensive Engineering & QA Audit
**Document Date:** November 4, 2026  
**Auditor:** Principal Engineer, QA Lead & Product Designer  
**Repository Branch:** `full-audit-and-polish` (base: `futuristic-v2`)  
**Commit Inspected:** `b602f81`  
**Target Environments:** Desktop Chrome/Edge/Firefox, Mobile WebKit (iOS Safari), Mobile Chromium (Android Chrome), Farcaster Mini App Webview, Base App Webview  

---

## Executive Summary

An exhaustive diagnosis was performed across build tooling, dead code, circular dependencies, npm package integrity, desktop and mobile responsive UI/UX, network resilience, on-chain transaction paths, API routes, security posture, and CI determinism.

### Summary Metrics
| Audit Category | Result | Key Evidence / Metric |
| :--- | :--- | :--- |
| **TypeScript Typecheck** | 0 Errors | `tsc --noEmit` exited with code 0 |
| **ESLint** | 0 Errors, 282 Warnings | Unused vars, `@typescript-eslint/no-explicit-any` |
| **Unit & Integration Tests** | 64/64 files passed (364 tests) | **Severe flakiness / live network calls**: tests make unmocked calls to `mainnet.base.org` yielding HTTP 429 Too Many Requests |
| **Next.js Production Build** | Passed in 17.9s | Deprecation warnings on `middleware.ts` convention & edge runtime |
| **Dependency Security (`npm audit`)** | 64 vulnerabilities (32 moderate, 31 high, 1 critical) | **1 Critical (CVSS 9.1)**: `proxy-addr` IP spoofing via IPv4-mapped IPv6 |
| **Secret & Hygiene Scan** | Exited with Code 1 (FAILED) | False-positive regex `0x[a-fA-F0-9]{64}` matched Morpho Blue `marketId` in commit `82b9a75f` |
| **Circular Dependencies** | 1 Circular Cycle | `lib/lending/types.ts` <-> `lib/lending/unified-comparison.ts` |
| **Files > 800 Lines** | 14 Files | `tokenized-stocks-registry.ts` (4,165 lines), `useWalletApp.ts` (2,066 lines), `useVoucherTab.ts` (1,810 lines) |
| **Mobile Horizontal Overflow** | 15 Route Failures | Screen overflow at 320px/390px/430px due to ambient glow blobs and header buttons |
| **Mobile Input Font Sizes (< 16px)** | 44 Input/Selects | Inputs styled with `14px` / `text-xs` trigger iOS WebKit auto-zoom ("screen is sometimes big") |
| **Broken API Route on `/launch`** | HTTP 404 | `TokenLaunchForm.tsx:227` calls non-existent `/api/stocks/markets` (correct route is `/api/stocks`) |
| **Hardcoded Baseline Users** | Active in Prod | `BASELINE_USER_COUNT = 2342` hardcoded in `lib/redis-unique-users.ts` & `hooks/useUniqueUsers.ts` |
| **Unauthenticated Unique User POST** | Vulnerable | `POST /api/app/unique-users` accepts arbitrary string without wallet signature or tx confirmation |
| **Hardcoded Fallback APRs** | Active in Prod | Hardcoded APY (293.17%, 54.45%) & TVLs in `lib/lending/unified-comparison.ts` & `user-positions.ts` |
| **Mobile Wallet Deep Linking** | Broken for standalone mobile | Mobile browser clicks on MetaMask / Coinbase Wallet open desktop download URLs instead of app deep links |

---

## 1. Build & Tooling Audit

### 1.1 Typecheck (`tsc --noEmit`)
- **Status:** **PASS**
- **Command:** `npm run typecheck`
- **Output:** Clean exit with code 0.

### 1.2 Linter (`eslint`)
- **Status:** **PASS (with 282 warnings)**
- **Command:** `npm run lint`
- **Output:** `✖ 282 problems (0 errors, 282 warnings)`
- **Key Categories:**
  - `@typescript-eslint/no-unused-vars`: 218 instances (e.g. `components/explore/ExploreHub.tsx:46-54`, `app/api/token-logo/[address]/route.ts:11-12`).
  - `@typescript-eslint/no-explicit-any`: 64 instances (e.g. `app/api/markets/lending/route.ts:39`, `lib/lending/unified-comparison.ts:25`).

### 1.3 Unit & Invariant Tests (`vitest run`)
- **Status:** **FRAGILE / LEAKING NETWORK CALLS**
- **Command:** `npx vitest run`
- **Duration:** 19.28 seconds
- **Pass Count:** 64 passed (64 test files), 364 passed (364 tests)
- **Vulnerabilities / Evidence:**
  - `test/lending/protocol-comparison-hub.test.ts` line 3629 made live calls to `https://mainnet.base.org/` and threw:
    ```
    [Aave Discovery] Failed to read Aave V3 reserves on Base: ContractFunctionExecutionError: HTTP request failed.
    Status: 429
    URL: https://mainnet.base.org/
    Contract Call: address 0x2d8A3C5677189723C4cB8873CfC9C8976FDF38Ac, function getAllReservesTokens()
    Details: Too Many Requests
    ```
  - `test/portfolio/portfolio-client.test.ts` took **15.9 seconds** and `test/lending/protocol-comparison-hub.test.ts` took **12.6 seconds** due to unmocked external RPC round trips.
  - Vitest warning: ESM syntax in CommonJS loader (`vitest.config.ts:1:1`).

### 1.4 Production Build (`next build`)
- **Status:** **PASS (with Next.js 16 deprecation notices)**
- **Command:** `npm run build`
- **Duration:** Compiled successfully in 17.9s; static pages generated in 2.6s.
- **Evidence:**
  - `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` (Next.js 16 breaking change).
  - `⚠ The Edge Runtime is deprecated. You can use the "nodejs" runtime instead.`
  - `Skipping Go collector (go not installed — wallet sync uses JS fallback)`.

### 1.5 Contract Compilation & Tests (`forge`)
- **Status:** **NOT INSTALLED LOCALLY (Mock fallback passed)**
- **Command:** `npm run contracts:test` (`forge test -vvv || npx vitest run lib/contracts/`)
- **Evidence:** Vitest contract logic test fallback passed (14/14 tests in 925ms).

### 1.6 Production Security Audit (`npm audit`)
- **Status:** **FAIL (1 Critical, 31 High, 32 Moderate)**
- **Command:** `npm audit --omit=dev --audit-level=critical`
- **Critical Finding (CVSS 9.1):**
  - Package: `proxy-addr` (1.1.0 - 2.0.7)
  - Title: `proxy-addr vulnerable to IP spoofing via IPv4-mapped IPv6 trust subnet`
  - Advisory: [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)
  - Impact: Spoofed client IP can bypass geolocation compliance middleware and rate limiting.
- **Masking Bug in CI:** `.github/workflows/ci.yml:33` runs `npm audit --omit=dev --audit-level=critical || echo "Upstream dependency audit completed"`, completely masking this failure!

### 1.7 Secrets & Hygiene Scanner (`npm run secrets:scan`)
- **Status:** **FAIL (Exit code 1)**
- **Command:** `node scripts/scan-secrets.mjs`
- **Evidence:**
  ```
  ⚠️ WARNING: Found 1 potential secrets / hygiene issues:
    - [Raw EVM Private Key] in commit 82b9a75f: lib/lending/unified-comparison.ts: 0xfef5...e479
  ```
- **Root Cause Analysis:** `scripts/scan-secrets.mjs:14` checks `/0x[a-fA-F0-9]{64}\b/g` against all git history commits. In commit `82b9a75f49cc31f6423616094ad80061f742aae5`, a Morpho Blue market ID (`0xfef5641f70e19a87e369304daa9ba823754f3db1e6481d757fcae0442cffe479`) was added, which is a 32-byte hash and NOT a private key. The scanner has no check for Morpho market IDs or context, causing CI failure unless whitelisted.

---

## 2. Architecture, Dead Code & Structure

### 2.1 Circular Dependencies (`madge`)
- **Status:** **1 Circular Cycle Found**
- **Evidence:** `lib/lending/types.ts` imports from `lib/lending/unified-comparison.ts` (line 117), while `lib/lending/unified-comparison.ts` imports types from `lib/lending/types.ts` (line 1).
- **Remediation:** Extract shared vault interface types into a leaf types file `lib/lending/vault-types.ts`.

### 2.2 Unused Dependencies (`depcheck`)
- `@coinbase/cdp-sdk`: Listed in `dependencies` and `overrides`, but zero source file imports.
- `@farcaster/miniapp-wagmi-connector`: Not imported in any source file.
- `@neynar/nodejs-sdk`: Direct SDK not used.
- `@neynar/react`: Listed in `dependencies`, not imported.
- `@vercel/kv`: Listed in `dependencies`, not imported.
- `@x402/next`: Listed in `dependencies`, not imported.
- `axios`: Listed in `dependencies`, app uses native `fetch`.
- `recharts`: Listed in `dependencies`, not imported in active components.

### 2.3 Missing Declared Dependencies
- `sharp`: Explicitly imported in `app/api/token-logo/[address]/route.ts:5`, `scripts/seed-token-logos.mjs`, and thumbnail scripts. It currently resolves only because another package brought it into `node_modules`, but is missing from `package.json`.

### 2.4 Monolithic Files (> 800 Lines)
| File | Lines | Responsibility & Split Plan |
| :--- | :--- | :--- |
| `lib/stocks/tokenized-stocks-registry.ts` | 4,165 | Static registry data for 32 stocks. Safe as static data, but can be split into JSON/TS data chunks by sector. |
| `hooks/useWalletApp.ts` | 2,066 | Global application hook containing connection, transactions, toasts, sync, daily actions, and tab routing. Split into: `useWalletConnection`, `useDailyActions`, `useWalletAnalytics`, `useAppTransactions`, and `useAppUI`. |
| `hooks/useVoucherTab.ts` | 1,810 | Monolithic voucher state hook (create, redeem, list, credentials). Split into: `useVoucherCreate`, `useVoucherRedeem`, `useVoucherList`. |
| `components/docs/DocumentsClient.tsx` | 1,465 | In-app documentation and legal disclaimers. Extract sections into `/components/docs/sections/`. |
| `components/swap/DexSwapCard.tsx` | 1,288 | Swap trade execution, inputs, and allowances. |
| `lib/lending/markets.ts` | 1,187 | Lending protocol definitions and adapter mappings. |
| `components/lending/LendingHub.tsx` | 1,035 | Lending hub UI, gauge calculations, and tables. |
| `components/launchpad/TokenSwapPanel.tsx` | 1,022 | Launchpad token trading card. |
| `components/stocks/StockDetailComparisonModal.tsx` | 996 | Modal comparing lending & staking protocols for tokenized stocks. |
| `components/voucher/VoucherCreateWizard.tsx` | 983 | Multi-step voucher batch creation wizard. |
| `components/lending/ActionDrawer.tsx` | 936 | Action drawer for Morpho, Aave, Beefy, Moonwell supply/borrow/stake. |
| `components/stocks/StocksLendingHub.tsx` | 903 | Dedicated stock lending comparison hub. |
| `components/swap/DexSwapPanel.tsx` | 861 | Wrap around DexSwapCard and chart panel. |
| `components/launchpad/TokenDetailPanel.tsx` | 809 | Detailed token view on launchpad. |

---

## 3. Dependencies & Package Health

### 3.1 Deprecated & Outdated Packages
| Package | Installed | Latest | Status / Risk | Recommended Action |
| :--- | :--- | :--- | :--- | :--- |
| `@coinbase/onchainkit` | `1.1.2` | `1.1.3` (v2 deprecated) | Only used for `OnchainKitProvider` wrapper in `app/providers.tsx`. Pulls heavy outdated sub-deps (`uuid`, `zod < 4.6.6`). | Remove `@coinbase/onchainkit` or replace with lightweight Base provider. |
| `@metamask/sdk` | Transitive | Latest | Transitive dependency of `@wagmi/connectors` -> `@walletconnect/ethereum-provider`. Vulnerable `uuid` and `ws` versions. | Upgrade `viem` and `wagmi` in tested batch. |
| `viem` | `2.53.1` | `2.57.16` | Outdated minor, transitively pulls vulnerable `ws`. | Upgrade to `2.57.16`. |
| `wagmi` | `2.19.5` | `3.7.11` (v3 is major breaking) | Stable on v2. Upgrade to latest v2 (`2.19.12`). | Upgrade to `2.19.12` (avoid v3 breaking changes for now). |
| `next` | `16.4.2` | `16.4.5` | Minor patch available. | Upgrade to `16.4.5`. |
| `eslint-config-next` | `16.1.6` | `16.4.5` | Version mismatch with `next` `16.4.2`. | Align to `16.4.5`. |

---

## 4. Mobile Layout & UX Diagnosis

Automated headless mobile audits were executed across 6 device viewports (`iPhone-SE` 320x568, `iPhone-14` 390x844, `iPhone-ProMax` 430x932, `Pixel-7` 412x915, `iPad-Portrait` 768x1024, `Desktop` 1280x800) and 12 routes. All screenshots saved to `docs/qa-screenshots/` and raw data saved to `docs/mobile-audit-results.json`.

### 4.1 Horizontal Overflow (`scrollWidth > innerWidth`)
- **15 Overflow Failures Detected** on screens < 430px:
  1. **Ambient Background Glow Blobs**: Elements with `div.absolute.top-[-15%]` have `width: 1100px` and extend to `rectRight: 710px` on a 320px viewport. While `overflow-x: clip` exists on `<main>`, unconstrained parent containers allow horizontal scroll on iOS Safari.
  2. **Top Navigation Header Actions**: On iPhone SE (320px width), the right-side header group (`div.flex.shrink-0`, `button.btn-primary.whitespace-nowrap`) has `rectRight: 363px` — **overflowing the screen by 43 pixels**!
  3. **Explore Filter Bar**: Filter chips wrap awkwardly or push horizontal boundary on 320px screens.
  4. **Lend & Stake Market Table**: Wide table columns on `/lend` require horizontal container scrolling rather than responsive stacked card presentation.

### 4.2 The "Screen is Sometimes Too Big" iOS Bug (Input Font Sizes < 16px)
- **44 Inputs/Selects Found with Font Size < 16px on Mobile**:
  - `components/explore/ExploreSearchBar.tsx`: `text-sm` (14px) computed font size.
  - `components/launchpad/StockQuotePicker.tsx:499`: `<input className="... text-xs ...">` (12px font size).
  - `components/voucher/VoucherMyCards.tsx:466`: 12px font size.
  - `components/voucher/VoucherShareSuccessModal.tsx:288`: 12px font size.
  - Search inputs on `/explore`, `/`, `/lend`, and `/docs`: All computed at 14px.
  - **Reproduction & Mechanism**: On iOS Safari, focusing any input with a computed font size under 16px triggers an automatic, unprompted zoom-in of the entire viewport. Because users rarely realize they must double-tap or pinch to zoom back out, the entire app appears permanently enlarged and cropped ("screen is sometimes too big").

### 4.3 Viewport Meta Tag Audit
- `app/layout.tsx:24-28`:
  ```ts
  export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  };
  ```
  - `userScalable` is correctly not disabled (WCAG compliant).
  - Safe area padding (`env(safe-area-inset-bottom)`) is present on some modals but missing on the sticky bottom navigation and footer bar.

### 4.4 Mobile Wallet Deep Linking Failure
- **File:** `components/wallet/ConnectWalletModal.tsx:37-94`
- **Issue:** On mobile devices (iOS Safari / Android Chrome), browser wallet detection returns `false` because browser extensions are not present in mobile browsers.
- **Defect:** Instead of rendering universal deep links (`https://metamask.app.link/dapp/...` or `https://go.cb-w.com/dapp?...`), the modal marks the buttons as `unavailable` and displays `Install extension` linking to `https://metamask.io/download/` and `https://www.coinbase.com/wallet/downloads`. Users on phones are redirected to an app store or download website instead of connecting their existing wallet!

---

## 5. Verification of Specific Suspects

### 5.1 Explore -> Swap Buy Token Preselection
- **File:** `components/swap/SwapTab.tsx:65-122`
- **Finding:** Confirmed bug.
  - `SwapTab` accepts `initialToken` passed from `HomeApp.tsx:239`.
  - When the user selects a new buy token in the Swap modal, local `buyToken` state updates.
  - However, `extraTokens` array in `useMemo` recreates a reference every time `buyToken` or `fromPick` updates (`[initialToken, searchParams, buyToken, fromPick]`), triggering `useWalletHoldings`.
  - Furthermore, if URL search params are updated or `HomeApp` triggers a re-render, the effect at line 68 re-evaluates `initialToken` and can overwrite the user's selected `buyToken`.

### 5.2 Swap Portfolio Card Missing Tokens vs Coinbase Wallet
- **Files:** `lib/portfolio/indexer.ts:155-270` & `lib/portfolio/spam-filter.ts:25-70`
- **Finding:** Confirmed discrepancy.
  - If `ALCHEMY_API_KEY` is not present, the app queries `https://base.blockscout.com/api/v2/addresses/.../token-balances`. Blockscout v2 heavily rate-limits (HTTP 429).
  - On Blockscout failure, the app falls back to on-chain multicall checking only `COMMON_BASE_TOKENS`, 32 stocks, and `ALL_VERIFIED_BASE_TOKENS` (~3,100 tokens). Any unlisted token or newly launched token held by the user in Coinbase Wallet is omitted.
  - Additionally, `evaluateTokenSpam` filters out tokens matching suspicious domain heuristics and places them in `hiddenTokens`, which are hidden from the primary swap portfolio drawer by default.

### 5.3 Mobile Launch Layout & Stock-Pair Picker Overflow
- **Files:** `components/launchpad/TokenLaunchForm.tsx:521-580` & `components/launchpad/StockQuotePicker.tsx:400-530`
- **Finding:** Confirmed.
  - On viewports < 360px, the 5-step guided header tabs (`TokenLaunchForm.tsx:545`) overflow horizontally because each step has fixed `w-7 h-7` with horizontal connectors.
  - In `StockQuotePicker.tsx:499`, search input uses `text-xs` (12px), inducing mobile Safari zoom.

### 5.4 Hardcoded APR/APY & TVL Fallbacks in Lending Hub
- **Files:** `lib/lending/unified-comparison.ts:140-225, 467-641` & `lib/lending/user-positions.ts:114`
- **Finding:** **Direct violation of the "Never show fake or hardcoded numbers in production" rule.**
  - `VERIFIED_BEEFY_STOCK_DETAILS`:
    - `MSFTc`: `apy: 293.17, tvlUsd: 70386` (Hardcoded!)
    - `TSLAc`: `apy: 54.45, tvlUsd: 50944` (Hardcoded!)
    - `SNDKc`: `apy: 181.78, tvlUsd: 109102` (Hardcoded!)
  - `unified-comparison.ts:467`: `beefyVerified?.tvlUsd ?? 142_000`
  - `unified-comparison.ts:509`: `aeroVerified?.tvlUsd ?? 280_000`
  - `unified-comparison.ts:597`: `iporVerified?.apy ?? iporDiscovered?.supplyApy ?? 7.47`
  - `unified-comparison.ts:640`: `availableLiquidityUsd: aaveDiscovered?.liquidityUsd ?? 14_800_000`
  - `unified-comparison.ts:641`: `tvlUsd: aaveDiscovered?.tvlUsd ?? 34_800_000`
  - `user-positions.ts:114`: `apy: VERIFIED_BEEFY_STOCK_DETAILS["TSLAc"]?.apy ?? 54.45`
  - **Remediation:** If real-time on-chain or API data is unavailable, display `"Unavailable"` or `null` — never display hardcoded mock yields.

### 5.5 Hardcoded BASELINE_USER_COUNT (2342)
- **Files:** `lib/redis-unique-users.ts:5, 218, 227, 230` & `hooks/useUniqueUsers.ts:13, 56`
- **Finding:** Confirmed fake counter baseline.
  - `const BASELINE_USER_COUNT = 2342;`
  - `return Math.max(BASELINE_USER_COUNT, count);`
  - `return BASELINE_USER_COUNT + localUniqueUsers.size;`
  - The counter is clamped to a minimum of 2,342 users.

### 5.6 `POST /api/app/unique-users` Accepting Unverified Addresses
- **File:** `app/api/app/unique-users/route.ts:30-44`
- **Finding:** Confirmed vulnerability.
  - Takes `{ address: string }` from request body without signature verification, transaction hash receipt verification, or rate limiting.
  - Any client can spam POST requests with fabricated Ethereum addresses to artificially increment the user count.

### 5.7 Broken `/api/stocks/markets` Endpoint (HTTP 404)
- **File:** `components/launchpad/TokenLaunchForm.tsx:227`
- **Finding:** `TokenLaunchForm.tsx` fetches `/api/stocks/markets` on mount to populate stock prices. The route does not exist (the actual route is `/api/stocks`), causing a 404 error on `/launch` on every load and leaving stock prices unpopulated.

---

## 6. Security & Hygiene Review

### 6.1 Token Approvals (Exact vs Unlimited)
- **Status:** **PASS**
- **Evidence:** `components/swap/DexSwapCard.tsx:671` uses `encodeB20ApproveCalldata(targetSpender, exactNeeded)` approving only the exact trade amount. `VoucherCreateWizard.tsx` explicitly enforces exact deposit approvals. No `maxUint256` approvals exist in active production paths.

### 6.2 Platform & Creator Fee Policy
- **Status:** **PASS**
- **Evidence:** `app/api/launchpad/quote/route.ts:231-248` computes:
  - 50 bps (0.50%) total fee on platform-launched tokens (split 25 bps creator / 25 bps platform).
  - 25 bps (0.25%) flat platform fee on general token swaps and tokenized stocks.

### 6.3 Client Secrets Exposure
- **Status:** **WARNING**
- **Evidence:** `.env.local:5` contains `NEXT_PUBLIC_ALCHEMY_KEY="mn8s-DCTchMi4q2DEKasm"`. Exposing Alchemy keys with `NEXT_PUBLIC_` embeds the key in client-side JavaScript bundles.
- **Remediation:** Route all RPC requests through `/api/rpc` or server-side functions using `ALCHEMY_API_KEY`.

### 6.4 Content Security Policy & Security Headers
- **Status:** **SATISFACTORY (with 2 improvements needed)**
- **File:** `next.config.ts:151-183`
- CSP headers are configured with strict frame-ancestors for Farcaster Mini App.
- **Missing:**
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `X-Frame-Options` is omitted (handled by CSP `frame-ancestors`, but recommended to set fallback).

---

## 7. CI / GitHub Actions Diagnosis

### 7.1 Local CI Reproduction
Reproducing `.github/workflows/ci.yml` locally uncovered several critical flaws:

| CI Step | CI Command | Local Test Result | Root Cause & Flakiness Risk |
| :--- | :--- | :--- | :--- |
| **Unit Tests** | `npm test` | **FLAKY / UNRELIABLE** | Unit tests call live Base RPC and external APIs (`https://mainnet.base.org`). Cloudflare returns HTTP 429 rate limit during test execution. |
| **Swap Route Smoke Test** | `npm run test:swap-routes:local` | **BLOCKED BY LIVE NETWORK** | Script queries live 0x API and DexScreener endpoints. Network blips break the build. |
| **Security Audit** | `npm audit ... \|\| echo` | **MASKS FAILURES** | The `\|\| echo` statement hides 1 Critical and 31 High CVEs from failing the PR check. |
| **Gitleaks Scanner** | `gitleaks-action` | `continue-on-error: true` | Masks secret leaks. |
| **Secrets Scanner** | `node scripts/scan-secrets.mjs` | **FAILS (Exit 1)** | Fails on commit `82b9a75f` due to Morpho `marketId` false positive. |
| **Foundry Toolchain** | `foundry-rs/foundry-toolchain@v1` | `nightly` | Nightly toolchain versions can introduce breaking compiler or cheatcode changes at any time. Should pin a stable release or tag. |
| **Slither Action** | `slither-action@v0.4.0` | `continue-on-error: true` | Masks contract security warnings. |
| **Caching** | `cache: npm` | Incomplete | Lacks Playwright browser binary cache (`~/.cache/ms-playwright`) and Next.js build cache (`.next/cache`), adding 3-5 minutes to each CI run. |

---

## 8. Ranked Issue List (P0 – P3)

### Priority P0: Funds / Security / Data Loss / Build Blocker
1. **[P0-1] Critical CVE in Production Dependencies (`proxy-addr` CVSS 9.1)**
   - *Issue:* IP spoofing vulnerability allows attackers to bypass geolocation sanctions and IP-based rate limiting via IPv4-mapped IPv6 headers.
   - *Fix:* Run `npm update proxy-addr` / fix dependencies; remove `|| echo` mask in CI.
2. **[P0-2] Secrets Scanner False Positive Fails Build (`scripts/scan-secrets.mjs`)**
   - *Issue:* Morpho Blue bytes32 market ID in commit `82b9a75f` triggers "Raw EVM Private Key" regex.
   - *Fix:* Whitelist Morpho Blue market IDs in `scripts/scan-secrets.mjs`.
3. **[P0-3] Unauthenticated User Inflation (`app/api/app/unique-users/route.ts`)**
   - *Issue:* `POST /api/app/unique-users` accepts arbitrary string without wallet verification.
   - *Fix:* Verify on-chain transaction receipt server-side (`txHash`) before incrementing unique user count.

### Priority P1: Broken Core Flows
1. **[P1-1] Broken 404 Route on Launch Page (`TokenLaunchForm.tsx:227`)**
   - *Issue:* Requests `/api/stocks/markets` which does not exist (404), leaving stock prices empty.
   - *Fix:* Change fetch endpoint to `/api/stocks`.
2. **[P1-2] Mobile Safari Auto-Zoom Bug (44 Inputs < 16px font-size)**
   - *Issue:* Search bars and modal inputs use `text-xs` (12px) or `14px`, causing iOS WebKit to force viewport zoom on tap ("screen is sometimes too big").
   - *Fix:* Enforce global minimum 16px computed font size on mobile for all `input`, `select`, `textarea`.
3. **[P1-3] Mobile Wallet Deep Linking Broken (`ConnectWalletModal.tsx:76-94`)**
   - *Issue:* Standalone mobile browser users tapping MetaMask or Coinbase Wallet are sent to desktop download pages (`https://metamask.io/download/`) instead of native app deep links.
   - *Fix:* Detect mobile user agents and generate proper deep link URLs (`https://metamask.app.link/dapp/...`, `https://go.cb-w.com/dapp?...`).
4. **[P1-4] Explore -> Swap Buy Token Overwrite Bug (`SwapTab.tsx:65-122`)**
   - *Issue:* `initialToken` passed from `HomeApp` re-runs on state re-renders and overwrites user's selected buy token.
   - *Fix:* Use explicit user-selection flag that permanently locks user choice over URL defaults.
5. **[P1-5] Unit Test Network Flakiness (Base RPC 429 Rate Limits)**
   - *Issue:* `npm test` makes live unmocked RPC calls to `mainnet.base.org`, causing 16s test delays and random CI timeouts.
   - *Fix:* Hermetically mock all network calls in Vitest; move live network tests to `npm run test:live`.
6. **[P1-6] Hardcoded Fallback APRs/TVLs in Lending Hub**
   - *Issue:* Production code falls back to hardcoded 293.17% APY and $14.8M TVL when live RPC is unavailable.
   - *Fix:* Display `"Unavailable"` or empty state when live pool data cannot be reached.

### Priority P2: UX, Layout & Performance
1. **[P2-1] Horizontal Overflow on Mobile Screens < 430px (15 Routes)**
   - *Issue:* Ambient glow blobs (width 1100px) and top nav header buttons (`rectRight: 363px` on 320px viewport) spill past viewport width.
   - *Fix:* Contain header actions and constrain absolute background decorative elements.
2. **[P2-2] Circular Dependency: `types.ts` <-> `unified-comparison.ts`**
   - *Issue:* `lib/lending/types.ts` imports from `unified-comparison.ts`.
   - *Fix:* Extract common vault interface types into `lib/lending/vault-types.ts`.
3. **[P2-3] Missing Declared Dependency (`sharp`)**
   - *Issue:* `app/api/token-logo/[address]/route.ts` imports `sharp`, but `sharp` is omitted from `package.json`.
   - *Fix:* Add `sharp` to `dependencies`.
4. **[P2-4] Next.js 16 Deprecations (`middleware.ts` & Edge Runtime)**
   - *Issue:* Next.js 16 deprecates `middleware.ts` convention in favor of `proxy` and edge runtime on static routes.
   - *Fix:* Migrate middleware to proxy or nodejs runtime.
5. **[P2-5] Missing CI Caching (Playwright Browsers & `.next/cache`)**
   - *Issue:* Playwright binaries and Next.js build cache re-download / rebuild from scratch on every run.
   - *Fix:* Add GitHub Actions caching for Playwright and `.next/cache`.

### Priority P3: Code Cleanup & Hygiene
1. **[P3-1] Monolithic `hooks/useWalletApp.ts` (2,066 Lines)**
   - *Split:* Extract into `useWalletConnection`, `useDailyActions`, `useWalletAnalytics`, `useAppTransactions`, and `useAppUI`.
2. **[P3-2] 282 ESLint Warnings**
   - *Fix:* Clean up unused imports, dead variables, and remove `any` types.
3. **[P3-3] Unused Dependencies in `package.json`**
   - *Fix:* Remove `@coinbase/cdp-sdk`, `@neynar/nodejs-sdk`, `@neynar/react`, `@vercel/kv`, `@x402/next`, `axios`, `recharts`.
4. **[P3-4] Hardcoded `BASELINE_USER_COUNT = 2342`**
   - *Decision:* Remove fake baseline; report verified unique on-chain transacting addresses.

---

## 9. Phase 2 Implementation Plan

Following user approval, execution will proceed strictly in order:

1. **Batch 1 (P0 Security & Tooling Fixes):**
   - Fix `proxy-addr` vulnerability (`npm update proxy-addr`).
   - Fix `scripts/scan-secrets.mjs` Morpho market ID false positive.
   - Remove `|| echo` from CI audit step.
   - Fix `POST /api/app/unique-users` to require confirmed on-chain transaction verification.

2. **Batch 2 (P1 Broken Flows & Resilience):**
   - Fix `/api/stocks/markets` 404 in `TokenLaunchForm.tsx`.
   - Fix Explore -> Swap token preselection overwrite bug in `SwapTab.tsx`.
   - Eliminate hardcoded APR/TVL fallbacks in `unified-comparison.ts` and `user-positions.ts` (return `"Unavailable"` on failure).
   - Mock all Vitest external network calls for hermetic testing; isolate live network checks to `test:live`.

3. **Batch 3 (P1 & P2 Mobile Optimization):**
   - Add global mobile CSS rule ensuring 16px minimum font-size for all inputs, selects, textareas to eliminate iOS zoom.
   - Fix header button and ambient glow horizontal overflow on 320px/390px/430px viewports.
   - Add native mobile deep links (`metamask.app.link`, `go.cb-w.com`) in `ConnectWalletModal.tsx`.
   - Update `playwright.config.ts` with mobile viewports (iPhone SE, iPhone 14, iPhone Pro Max, Pixel 7, iPad portrait, Desktop).

4. **Batch 4 (P2 & P3 Cleanup, Split & CI Hardening):**
   - Add missing `sharp` to `package.json` dependencies; remove unused dependencies.
   - Resolve circular dependency between `types.ts` and `unified-comparison.ts`.
   - Split `hooks/useWalletApp.ts` into smaller typed modular hooks behind regression tests.
   - Add GitHub Actions caching for Playwright and Next.js; add `npm run ci:local`.
   - Resolve ESLint warnings across app code.
