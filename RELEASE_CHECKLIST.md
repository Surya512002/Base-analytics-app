# Base Mainnet Release & Go-Live Checklist

This checklist documents the required pre-flight gates, release workflow, live-app compatibility guarantees, environment variable matrices, security validations, and incident rollback procedures for **Base Analytics App** (live on Vercel with real users).

---

## 1. Release Workflow & Promotion Process

### Step 1: Work on a Feature Branch
- **Never push directly to `main`**.
- Create a dedicated, descriptive branch from up-to-date `main`:
  ```bash
  git checkout main
  git pull origin main
  git checkout -b feat/your-feature-name
  ```
- Keep commits atomic, well-documented, and free of any credentials or secrets.

### Step 2: Local Verification Before Pushing
Run all automated checks locally before pushing your branch:
```bash
# 1. Typecheck and linting
npm run typecheck
npm run lint

# 2. Secret scanning
npm run secrets:scan

# 3. Comprehensive unit and invariant tests
npm test

# 4. Production build test
npm run build
```

### Step 3: Open a Pull Request
- Push branch to GitHub: `git push -u origin feat/your-feature-name`.
- Open a Pull Request targeting `main`.
- Fill in the PR template:
  - Summary of changes and user impact.
  - Confirmation of backward compatibility (claim links, storage keys, contract ABIs).
  - Evidence of passing tests and zero secret exposure.

### Step 4: Validate the Vercel Preview Deployment
Every pull request triggers an isolated Vercel Preview Deployment:
1. **Access the Preview URL**: Find the preview link in the GitHub PR comments or the Vercel dashboard.
2. **Test Wallet Connections**:
   - Connect via Coinbase Smart Wallet (passkeys), MetaMask/Injected, and Farcaster miniapp environment.
   - Confirm Content-Security-Policy (CSP) does not block `keys.coinbase.com` or RPC endpoints.
3. **Verify Voucher Claim Compatibility**:
   - Test legacy query format: `/?tab=voucher&card=41-0`
   - Test modern safe hash fragment format: `/?tab=basehub&view=redeem#id=41-0&secret=XYZ`
   - Test dedicated redeem landing page: `/redeem?card=41-0`
4. **Smoke Test Core Features**:
   - Live Lend & Stake positions and action drawer rendering.
   - Token swap quote generation and execution guardrails.
   - B20 token launch review step and fee distribution calculation.
5. **Inspect Console & Network**: Ensure zero uncaught errors, blocked CSP directives, or failing API calls.

### Step 5: Merge to `main` & Production Promotion
- Ensure all CI status checks (Typecheck, Lint, Tests, Secret Scanner) are green.
- Perform a **Squash and Merge** into `main`.
- Vercel automatically deploys the merged commit to Production.
- Monitor deployment logs in real-time in the Vercel Dashboard until `Status: Ready`.

### Step 6: Post-Deployment Production Sanity Checks
- Verify production URL (`https://base-analytics-app.vercel.app`).
- Confirm wallet connect, real positions lookup, and voucher lookup on live Base mainnet.
- Verify status of Vercel Crons (`/api/cron/price-alerts`).

---

## 2. Vercel Instant Rollback Plan

If a critical regression, broken UI, or unexpected RPC failure occurs post-deploy:

### Option A: Vercel Dashboard Instant Rollback (Recommended)
1. Go to **Vercel Project Dashboard** -> **Deployments**.
2. Find the last known healthy deployment (marked with green checkmark).
3. Click the three dots `...` next to that deployment and select **Instant Rollback** (or **Promote to Production**).
4. Confirm the rollback. Vercel updates edge routing instantly (**< 3 seconds**) without rebuilding or downtime.

### Option B: Vercel CLI Instant Rollback
```bash
# Rollback to the previous production deployment
vercel rollback

# Or rollback directly to a specific deployment URL or ID
vercel rollback dpl_xxxxxxxxxxxxxxxx
```

### Option C: Hotfix Revert Branch
If an environment variable or contract configuration change was the cause:
```bash
git checkout main
git pull origin main
git revert HEAD -m 1
git push origin main
```

---

## 3. Live-App Compatibility Guarantees

The app is live with real users. The following backward compatibility guarantees are mandatory:

### A. Supported Voucher Claim Link Formats
All existing claim links generated since launch must resolve seamlessly:
| Format Style | Example URL | Expected Behavior |
| :--- | :--- | :--- |
| **Modern Safe Fragment** | `/?tab=basehub&view=redeem#id=41-0&secret=SEC123` | Secret kept client-side (no HTTP referrer leak); pre-fills Card ID & secret on redeem panel. |
| **Fragment Key Alias** | `/?tab=basehub#id=41-0&key=SEC123` | Alias `key` parsed as secret; directs to redeem view. |
| **Standard Query** | `/?tab=basehub&card=41-0&secret=SEC123` | Legacy query format; pre-fills Card ID and secret. |
| **Legacy Tab Query** | `/?tab=voucher&card=41-0` or `?tab=vouchers` | `tab=voucher` aliased to `basehub`; pre-fills Card ID. |
| **Short Query Aliases**| `/?c=41-0&s=SEC123` or `/?voucher=41-0` | Normalized by `lib/voucher/claim-link-parser.ts`. |
| **Dedicated Landing** | `/redeem?card=41-0` or `/redeem#id=41-0&secret=...` | Previews card onchain; "Connect & Redeem" button transfers card and secret into app. |
| **Root Fragment Link**| `/#id=41-0&secret=SEC123` | Infers `basehub` tab and navigates directly to redeem panel. |

### B. Browser Storage & Database Registry
All keys must read existing user data with safe defaults (zero destructive schema changes):
| Storage Layer | Key / Pattern | Description & Compatibility Guarantee |
| :--- | :--- | :--- |
| `localStorage` | `base_redeem_card` | Temporary cardId saved when navigating from landing page. Safely cleared once loaded. |
| `localStorage` | `base_voucher_batches_{address}` | Local cache of batches created by address with secrets. Parsed with `JSON.parse` fallback. |
| `localStorage` | `base_voucher_pending_{address}` | In-flight voucher batch awaiting block confirmation. Survives mobile reloads. |
| `localStorage` | `base_badge_levels_{address}` | Onchain badge level tracking per wallet. |
| `localStorage` | `base_ref_code`, `base_ref_bonus_xp` | Referral attribution and bonus points tracking. |
| `localStorage` | `base_wallet_recent_tokens` | Swapped token addresses for quick-pick drawer. |
| `localStorage` | `base_token_watchlist` | User-curated list of watched tokens. |
| `sessionStorage`| `base_guest_resume` | Restores tab and context after guest connects wallet. |
| `Cookie` (httpOnly)| `ba_siwe_session` | Cryptographically signed SIWE session token (HMAC-SHA256). |
| `Cookie` | `ba_analytics_unlock` | Analytics access verification token. |
| `Redis (KV)` | `base_voucher_credentials_{address}` | Encrypted/hashed server backup of batch credentials for creator recovery. |
| `Redis (KV)` | `base_voucher_batches` | Public metadata array of created batches. |
| `Redis (KV)` | `launchpad:tokens:registry` | Registry of tokens launched on B20 platform. |
| `Redis (KV)` | `wallet:analyze:{address}` | Cached wallet analytics for instantaneous reconnects. |

### C. Live Base Mainnet Contracts & ABIs
Every contract address and ABI is verified on Base Mainnet (`chainId: 8453`):
| Contract | Live Address | Bytecode Size | Verified ABI Functions |
| :--- | :--- | :--- | :--- |
| **`BaseVoucher`** | `0xE425b060d888DD54C57160f4c3B0d3Fb76EcCf25` | 9,516 B | `createBatch`, `redeem`, `getBatch`, `getCardStatus`, `nextBatchId` |
| **`Predictions`** | `0xdB72435f46B9a5609F59E940b7f37f2cA4d57f78` | 12,212 B | `bet`, `resolveMarket`, `claimPayout`, `getMarket` |
| **`BOOSTER`** | `0x0d1BE33F8B6a33BeEe7b3bb834DF6f8c168B2e46` | 896 B | `boost`, `boosts(address)` |
| **`GM_GN`** | `0xdb4f873B33F448aeA8Bb2b3B7e3ab9561329608A` | 1,454 B | `gm`, `gn`, `lastGm`, `lastGn` |
| **`ACHIEVEMENTS`** | `0xadb8120B4B18b892cFAD171243074487122Dea03` | 10,518 B | `mintAchievement`, `hasMinted`, `balanceOf` |
| **`CHECKIN`** | `0xABc7099C631E18640ea60b25116407aa17354FBb` | 1,582 B | `checkIn`, `streaks`, `lastCheckIn` |
| **`USDC` (Base Native)** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 3,706 B | `approve`, `transfer`, `balanceOf`, `allowance` |
| **`Base Bridge`** | `0x4200000000000000000000000000000000000010` | 4,112 B | Standard Base L1/L2 Bridge |
| **`Morpho Blue`** | `0xBBBBBbbBBb9cC5e90e3b3Af62C37EEFFCb` | 31,248 B | Singleton Lend/Borrow Engine |
| **`ERC-4337 EntryPoint 0.6`** | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | 47,380 B | Smart Account UserOp Relay |
| **`ERC-4337 EntryPoint 0.7`** | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | 32,072 B | Smart Account UserOp Relay v0.7 |

---

## 4. Environment Variables by Scope

| Variable Name | Production | Preview | Development | Exposed to Browser? | Classification |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `NEXT_PUBLIC_APP_URL` | ✅ | ✅ (Preview URL) | ✅ (localhost) | **YES** | Public Config |
| `NEXT_PUBLIC_BUILDER_CODE` | ✅ | ✅ | ✅ | **YES** | Public Attribution (`bc_4uoh9iu2`) |
| `NEXT_PUBLIC_VOUCHER_CONTRACT` | ✅ | ✅ | ✅ | **YES** | Public Address (`0xE425...`) |
| `NEXT_PUBLIC_PREDICTIONS_CONTRACT` | ✅ | ✅ | ✅ | **YES** | Public Address (`0xdB72...`) |
| `NEXT_PUBLIC_ALCHEMY_KEY` | ✅ | ✅ | ✅ | **YES** | Client API Key (Capped) |
| `NEXT_PUBLIC_PAYMASTER_URL` | ✅ | ✅ | ✅ | **YES** | Client Gas Sponsorship Endpoint |
| `NEXT_PUBLIC_CDP_API_KEY` | ✅ | ✅ | ✅ | **YES** | OnchainKit Client ID |
| `NEXT_PUBLIC_LAUNCHPAD_PLATFORM_FEE_BPS` | ✅ | ✅ | ✅ | **YES** | Public Config (`25`) |
| `NEXT_PUBLIC_LAUNCHPAD_TREASURY` | ✅ | ✅ | ✅ | **YES** | Public Treasury Wallet |
| `NEXT_PUBLIC_XP_STAKE_CONTRACT` | Optional | Optional | Optional | **YES** | Public Extension Contract |
| `NEXT_PUBLIC_BADGE_MARKETPLACE_CONTRACT` | Optional | Optional | Optional | **YES** | Public Extension Contract |
| `ALCHEMY_API_KEY` | ✅ | ✅ | Optional | **NO** | 🔒 **Secret (Backend API)** |
| `SIWE_SESSION_SECRET` | ✅ | ✅ | Optional | **NO** | 🔒 **Secret (HMAC Key)** |
| `BASESCAN_API_KEY` / `BASESCAN_API_KEYS` | ✅ | ✅ | Optional | **NO** | 🔒 **Secret (Indexing API)** |
| `NEYNAR_API_KEY` | ✅ | ✅ | Optional | **NO** | 🔒 **Secret (Farcaster API)** |
| `ZEROX_API_KEY` | ✅ | ✅ | Optional | **NO** | 🔒 **Secret (DEX Aggregator)** |
| `KV_REDIS_URL` | ✅ | ✅ | ✅ | **NO** | 🔒 **Secret (Database URL & Pass)** |
| `MCP_API_KEY` | Optional | Optional | Optional | **NO** | 🔒 **Secret (Agent Bearer Auth)** |
| `BASE_DASHBOARD_API_KEY` | Optional | Optional | Optional | **NO** | 🔒 **Secret (App Notifications)** |
| `BASE_NOTIFICATIONS_ADMIN_SECRET` | Optional | Optional | Optional | **NO** | 🔒 **Secret (Webhook Admin)** |
| `X402_FACILITATOR_PRIVATE_KEY` | ✅ | ✅ | Optional | **NO** | 🚨 **High Secret (Sponsor Wallet Key)** |
| `PREDICTIONS_KEEPER_PRIVATE_KEY` | ✅ | ✅ | Optional | **NO** | 🚨 **High Secret (Keeper Wallet Key)** |
| `PREDICTIONS_KEEPER_SECRET` | ✅ | ✅ | Optional | **NO** | 🔒 **Secret (Keeper Auth)** |
| `CRON_SECRET` | ✅ | ✅ | Optional | **NO** | 🔒 **Secret (Vercel Cron Bearer)** |
| `DEPLOYER_PRIVATE_KEY` | ❌ Never | ❌ Never | Local scripts only | **NO** | 🚨 **High Secret (Never put in Vercel)** |

---

## 5. Security & CSP Configuration Check

Verified headers in `next.config.ts`:
- **`frame-ancestors`**: `'self' https://farcaster.xyz https://warpcast.com` (Allows embedded Farcaster miniapp).
- **`frame-src`**: `'self' https://keys.coinbase.com https://farcaster.xyz https://warpcast.com` (Allows Coinbase Smart Wallet passkey creation).
- **`connect-src`**: Includes Base mainnet, Alchemy, Coinbase developer platform, 0x API, Basescan, WalletConnect relayers, and Farcaster API.
- **`img-src`**: Allows Cloudinary, Google User Content, GitHub raw assets, CoinGecko, 1inch token logos, and Basescan.
- **`nosniff`**, **`Permissions-Policy`**, and **`strict-origin-when-cross-origin`** actively enforced.
