# Order caps: why they exist and how they grow

Every market in `LimitOrderBook` has two kinds of limit, both enforced on-chain and both owner-settable through the multisig:

| Limit | What it bounds | Set with |
|---|---|---|
| **Per-order cap** (`maxStockIn`, `maxQuoteIn`) | One order or one recurring plan | `setMarket()` |
| **Escrow ceiling** (`maxStockEscrow`, `maxQuoteEscrow`) | Total value deposited in a market, across all users (v2.1) | `setEscrowCaps()` |

The app reads the live on-chain values, so raising a limit never needs an app release.

## Why the first caps were ~$100

1. **No external audit yet.** Caps bound the loss from an undiscovered bug.
2. **No total limit.** Until v2.1 only each order was capped, so total exposure was unbounded.
3. **Thin stock liquidity.** A fill bigger than the pool can absorb is *refused* by the oracle fill-floor (`FillBelowOracleBound`); the order just waits. A bigger cap on a thin pool creates orders that cannot fill.

## What live Base mainnet quotes say

`limit-orders/scripts/recommend-caps.mjs` quotes buy and sell ladders through Uniswap V3 QuoterV2 and compares each fill with the Chainlink price (shortfall includes the pool fee).

| Market | $100 | $500 | $1,000 | $5,000 | $25,000 | Binding limit |
|---|---|---|---|---|---|---|
| NVDAc | 0.38% | 0.54% | 0.76% | 2.3% | 30% | pool depth |
| AAPLc | 0.52% | 3.1% (buy) | 19% (buy) | 83% | 97% | pool depth (buy side) |
| MSFTc | 1.4% | 2.7% | 4.3% | 43% | 89% | 1% fee tier + depth |
| GOOGLc | 0.64% | 2.2% (sell) | 4.9% (sell) | 70% | 94% | pool depth (sell side) |
| WETH | ~0.5% flat | ~0.5% | ~0.5% | ~0.5% | ~0.53% | none up to $100k |
| cbBTC | 0.14% | 0.15% | 0.15% | 0.16% | 0.22% | none up to $25k |

**Crypto markets can take far larger orders; stock markets cannot**, whatever the contract allows. WETH's ~0.5% is the 0.3% pool fee plus a small oracle basis, and does not grow with size.

## Current caps

| Market | Per-order cap | Escrow ceiling (stock / USDC) | Why |
|---|---|---|---|
| WETH | **$25,000** | ~$100k / $100k | cost flat to $100k |
| cbBTC | **$25,000** | ~$97k / $100k | 0.22% all-in at $25k |
| NVDAc | **$1,000** | ~$4.9k / $5k | deepest stock pool: 0.76% all-in at $1k, inside its 3% oracle bound |
| AAPLc | $250 | ~$2.9k / $2.5k | buy side breaks at $500 (3.1% > 3% bound) |
| MSFTc | $100 | ~$1k / $1k | 1% fee tier, already 1.4% at $100 |
| GOOGLc | $100 | ~$1k / $1k | sell side shallow |

Per-order caps for AAPLc, MSFTc and GOOGLc are set by pool depth, not policy: raise them only when liquidity grows. Re-run `recommend-caps.mjs` first.

**Why the escrow ceiling is the real safety valve.** A $25,000 per-order cap alone would let many orders stack up. The ceiling caps the total at risk per market, so the worst case of a contract bug or a bad feed is bounded (about $100k per crypto market) no matter how many orders users place.

Token-unit caps drift with price. `BOOK_ADDRESS=0x… node scripts/plan-cap-update.mjs --refresh-from-oracle` prints Safe-ready `setMarket` and `setEscrowCaps` calldata. It refuses a quote cap above $25,000, and refuses to run for any market without escrow ceilings in `deployConfig.json`.

## Honest risk statement

The order book is **not externally audited**. v2.1 adds: total escrow ceilings, a pause-only guardian key, and 94 passing tests including new accounting tests (escrow released exactly once for fills, cancels, expiry, brackets; saturating so accounting can never block a withdrawal). Before holding real value:

- [ ] External audit of `LimitOrderBook.sol` and `UniswapV3Adapter.sol`
- [ ] Run `docs/MAINNET-CANARY.md` on every market (including recurring sells and escrow ceilings)
- [ ] Deploy with a multisig owner and set a **guardian** (`setGuardian`) on a separate hot key
- [ ] Start with the ceilings at 10% of the table above and step up weekly
- [ ] Keeper monitoring: failed fills, stale feeds, escrow vs token balances (`stockEscrowed` / `quoteEscrowed`)

## Remaining hardening (not done)

1. **Per-user open-order limit.** Needs careful open-count tracking across bracket siblings. The escrow ceiling already bounds the total, so this is lower priority.
2. **Oracle circuit breaker.** Refuse execution if the Chainlink price jumped more than X% between rounds.
3. **Timelock on limit increases** (`setMarket` caps / `setEscrowCaps`). Feed, adapter and oracle-bound changes are already timelocked (2 days); see docs/SECURITY-REVIEW-ORDERBOOK.md.

Users can always cancel and withdraw, even while paused. That invariant must not change.
