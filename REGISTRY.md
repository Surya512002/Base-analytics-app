# Base Tokenized Stock Registry & Automatic Discovery Architecture

## 1. Overview & Single Source of Truth

The Base Analytics Platform utilizes a centralized, typed, single-source-of-truth registry for all verified tokenized stocks and equities deployed on Base mainnet (Chain ID `8453`):

- **Master Registry**: [`lib/stocks/tokenized-stocks-registry.ts`](file:///d:/Base-analytics-app/lib/stocks/tokenized-stocks-registry.ts)
- **Pending Review Queue**: [`lib/stocks/pending-review.json`](file:///d:/Base-analytics-app/lib/stocks/pending-review.json)
- **Automatic Sync Script**: [`scripts/sync-stock-registry.mjs`](file:///d:/Base-analytics-app/scripts/sync-stock-registry.mjs) (`npm run registry:sync`)

Every stock entry in the registry satisfies the typed interface `TokenizedStockEntry`:
```typescript
export interface TokenizedStockEntry {
  symbol: string;             // e.g. "NVDAc", "AAPLc", "TSLAc"
  name: string;               // e.g. "NVIDIA Corp", "Apple Inc"
  underlyingTicker: string;   // e.g. "NVDA", "AAPL", "TSLA"
  address: Address;           // Strictly EIP-55 checksummed contract address
  decimals: number;           // Standard decimals (e.g. 8 for B20, 18 for Dinari)
  category: StockCategory;    // Tech | Finance | Healthcare | Consumer | Energy | Crypto-related | ETF/Index | Other
  issuer: StockIssuer;        // Coinbase | Dinari | Backed | Ondo | Superstate | Other
  priceFeed: StockPriceFeed;  // Chainlink aggregator or verified DEX feed
  logo: string;               // High-resolution SVG / WebP logo
  status: StockStatus;        // "active" | "paused" | "deprecated" | "pending"
  addedAt: string;            // ISO 8601 timestamp (e.g. "2024-01-15T00:00:00Z")
  restrictions: StockRestrictions; // Transfer restrictions, allowlists, pausable, rebase/splits
  description?: string;
}
```

Every consumer in the application (Explore, Lend & Stake, Launchpad Quote Picker, Vouchers, and Swap token pickers) imports directly from this master registry. Hardcoded counts (e.g. `"32"`) have been removed; categories and counts are derived dynamically via `getStockCategoryCounts()`.

---

## 2. Synchronization & Adding New Stocks

### Official Ingestion Pipeline (`npm run registry:sync`)

To discover new tokenized stocks emitted by official issuers, factories, or on-chain token registries on Base:
```bash
npm run registry:sync
```
The sync script:
1. Queries official token lists and verified registries (Coinbase B20 factory and issuer listings).
2. Computes strict EIP-55 checksums using `viem.getAddress`.
3. Checks whether the token address already exists in `TOKENIZED_STOCKS_REGISTRY`.
4. If a token is new, it is **never** automatically activated in user-facing UI. Instead, it is staged into `lib/stocks/pending-review.json` with status `"pending"`.

### Manual Approval Workflow
To promote a candidate from `pending-review.json` to active production:
1. Verify the contract address against official documentation or issuer announcements (e.g. BaseScan verified source code, issuer transparency dashboards).
2. Verify token decimals, transfer restrictions (`allowlistOnly`, `transferRestricted`), and the Chainlink price feed address.
3. Move the entry into `TOKENIZED_STOCKS_REGISTRY` in `lib/stocks/tokenized-stocks-registry.ts` with `status: "active"`.
4. Run the registry audit test:
   ```bash
   npx vitest run test/stocks/registry.test.ts
   ```
   This test enforces that all addresses are valid checksummed addresses and that no duplicate addresses exist.

---

## 3. Automatic Discovery Engine in Lend & Stake

The Lend & Stake engine continuously and automatically discovers lending, borrowing, and yield markets across 6 major protocols on Base mainnet:

| Protocol | Discovery Method | Base Mainnet Status & Notes |
| :--- | :--- | :--- |
| **Morpho Blue** | Official GraphQL API (`https://blue-api.morpho.org/graphql`) | Active on Base (`0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`). Queries `chainId_in: [8453]`, `listed: true`, with `first`/`skip` pagination. |
| **Aave** | On-chain Pool Data Provider (`0x2d8A3C5677189723C4cB8873CfC9C8976FDF38Ac`) | **Aave V3 is active on Base**. *Aave V4 is not yet deployed on Base* (nor on any mainnet yet; it is currently in design/development). |
| **Euler V2** | Governed Perspectives / Vault Listings | Active on Base. Discovers vetted EVaults paired with stock collateral or supply assets. |
| **Moonwell** | Official Base Comptroller (`0xfBb21d0380beE3312B33c4353c8936a0F13EF26C`) | Active on Base. Enumerates all listed mToken markets and reads collateral factors & rates. |
| **Superform** | Superform Router (`0x8e5f31ae56b19d4b4a3c20054a86f9e6144e1d5a`) & listings | Active on Base. Reads cross-chain and native ERC-4626 stock yield strategies. |
| **Aerodrome** | Voter (`0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`) & PoolFactory | Active on Base. Filters pools where one asset is a registry stock, computing reward APR from gauge emission rate and token prices. |

### API Endpoint (`/api/markets`)
The route `app/api/markets/route.ts` exposes cached discovery results with standard HTTP cache headers (`s-maxage=300, stale-while-revalidate=600`).

---

## 4. Matching Rule & Candidate Quarantine

To safeguard users against spoofed or unvetted tokens appearing in Lend & Stake:
1. **Active Registry Filter**: Only markets where the stock asset is active in `TOKENIZED_STOCKS_REGISTRY` are displayed to users.
2. **Quarantine of Unknown Assets**: When a protocol market involves a token that has stock-like naming characteristics (e.g. ticker ending in `c` or `d`, or name containing equity keywords) but is **NOT** in the active registry:
   - The token candidate is recorded into `lib/stocks/pending-review.json` with on-chain details.
   - The market is **completely excluded** from the UI response.

---

## 5. Discovery Safety Gates & Configuration Thresholds

The discovery engine enforces strict safety gates configured in [`lib/lending/discovery/types.ts`](file:///d:/Base-analytics-app/lib/lending/discovery/types.ts):

| Parameter | Default Value | Purpose |
| :--- | :--- | :--- |
| `MIN_LIQUIDITY_USD` | `$5,000` | Filters out illiquid or zombie pools with insufficient depth. |
| `REQUIRE_KNOWN_ORACLE` | `true` | Requires borrow markets to have a verified Chainlink or Pyth oracle. If unknown, sets `canBorrow: false`, shows amber warning badge, and disables borrowing. |
| `CAP_WARNING_THRESHOLD_PCT` | `90%` | Flags markets where utilization or supply/borrow caps exceed 90% with `CAP_NEARLY_REACHED`. |
| `CACHE_TTL_SECONDS` | `300` (5 min) | Caches multi-protocol discovery server-side with in-memory fallback. |
| `NEW_LISTING_BADGE_DAYS` | `7 days` | Displays a prominent "New" badge on newly listed stocks for 7 days after `addedAt`. |

### Resilient Protocol Outage Handling
If any single protocol adapter encounters an RPC error, rate limit, or 503 outage:
1. The engine retains the **last-good cached markets** for that protocol.
2. Other healthy protocols continue functioning with zero interruption.
3. The UI displays an inline protocol status indicator: `"Couldn't load Morpho Blue - Retrying..."` while keeping all other markets interactive.

---

## 6. Launchpad Quote Asset Picker & Math

In the Launchpad flow:
- Replaced the fixed 8-stock grid with `components/launchpad/StockQuotePicker.tsx`.
- Supports search by ticker, name, or address, category filter chips, and persistent `localStorage` favorites and recents.
- **Quote Asset Compatibility Rule**: OpenLaunch / B20 token deployments on Base use factory `0x815542E8b392389A1389E22E588E4B62A67Ade72` to deploy standard ERC-20 tokens. The factory calldata does *not* enforce an on-chain quote asset whitelist for creation; quote pairing occurs upon DEX liquidity seeding. All active registry stocks with standard ERC-20 interfaces and price feeds are compatible quote assets.
- **BigInt Financial Math**: In `lib/launchpad/launch-math.ts`, all starting prices, pool token allocations, and market cap calculations use integer BigInt scaling without floating-point precision loss across 6, 8, and 18 decimal tokens.

---

## 7. Token Edge Cases & Pre-Transaction Simulation

Some tokenized stocks enforce compliance allowlists, pause mechanisms, or transfer restrictions.

### Pre-Transaction Simulation (`lib/utils/tx-simulation.ts`)
Before prompting a user's wallet (in `ActionDrawer.tsx` and `StockDetailComparisonModal.tsx`), the application pre-simulates transaction execution using Base mainnet RPC `client.call`:
- If an execution reverts due to allowlist, transfer restriction, pause, or blocklist, the wallet prompt is **aborted immediately**.
- A clear, user-friendly notification is presented:
  > **"This token has transfer restrictions. You may not be eligible."**
- A contextual notice is rendered in the action drawer linking to issuer terms.

> **Legal Disclaimer Notice**: Eligibility and disclosure notices are subject to compliance and legal review. The platform does not provide legal, tax, or investment advice.
