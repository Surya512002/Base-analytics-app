# Order caps: why they exist and how they grow

Every market in `LimitOrderBook` has a **per-order cap** (`maxStockIn`, `maxQuoteIn`) that the contract enforces on-chain. Caps are set by the owner (a multisig on mainnet) through `setMarket()`, and the app reads the live on-chain value, so raising a cap never needs an app release.

## Why the first caps were ~$100

1. **No external audit yet.** The contract has unit, parity and fork tests, but no third-party audit. Per-order caps bound the loss from an undiscovered bug.
2. **No global escrow limit.** The contract caps each order, not total deposits, so a cap is the only lever on exposure per user action.
3. **Thin stock liquidity.** Tokenized-stock pools on Base are small. A fill that is bigger than the pool can absorb is *refused* by the oracle fill-floor (`FillBelowOracleBound`), so the order sits unfilled instead of filling at a bad price. A bigger cap on a thin pool would only create orders that cannot execute.

## What the data says (live Base mainnet quotes)

`scripts/recommend-caps.mjs` quotes buy and sell ladders through Uniswap V3 QuoterV2 and compares every fill with the Chainlink price. Shortfall includes the pool fee. Run it any time: `node scripts/recommend-caps.mjs`.

| Market | $100 | $500 | $1,000 | $5,000 | Binding limit |
|---|---|---|---|---|---|
| NVDAc | ~0.38% | ~0.54% | ~0.76% | 2.3% | pool depth |
| AAPLc | ~0.52% | 3.1% (buy) | 19% (buy) | 83% (buy) | pool depth (buy side) |
| MSFTc | ~1.4% | 2.7% | 4.3% | 43% | 1% fee tier + depth |
| GOOGLc | ~0.64% | 2.2% (sell) | 4.9% (sell) | 70% (sell) | pool depth (sell side) |
| WETH | ~0.5% flat | ~0.5% flat | ~0.5% flat | ~0.5% flat | none up to $100k |
| cbBTC | ~0.14% | ~0.15% | ~0.15% | ~0.16% | none up to $25k |

Take-away: **crypto markets can support far larger orders; stock markets cannot**, no matter what the contract allows.

## Stage 1 caps (this release, "Beta")

Rule: the largest ladder size whose extra shortfall (beyond the pool fee and oracle basis seen at $100) stays under 25 bp, with a $1,000 ceiling for crypto until the audit.

| Market | Per-order cap | Change |
|---|---|---|
| NVDAc | $500 | raised from ~$188 |
| AAPLc | $250 | raised from ~$171 |
| MSFTc | $100 | lowered from ~$133 (pool cannot fill more safely) |
| GOOGLc | $100 | lowered from ~$143 (sell side too shallow) |
| WETH | $1,000 | new market |
| cbBTC | $1,000 | new market |

Token-unit caps drift with price. Run `BOOK_ADDRESS=0x… node scripts/plan-cap-update.mjs --refresh-from-oracle` to print Safe-ready `setMarket` calldata that re-derives them.

## Stage 2 (gated)

Raise crypto to $5,000 (and later by liquidity) only after **all** of:

- [ ] Mainnet canary runbook (`docs/MAINNET-CANARY.md`) passes on every market
- [ ] 30 days of keeper uptime with no failed fills or stuck escrow
- [ ] External smart-contract audit complete, findings fixed
- [ ] Global per-market escrow ceiling added to the contract (see below)

`plan-cap-update.mjs` refuses any quote cap above `$5,000` without a code change, so a typo cannot skip the gate.

## Recommended contract hardening before large caps

These need a Solidity change and redeploy (the book is not on mainnet yet, so now is the cheapest time):

1. **`maxMarketEscrow`**: a cap on total deposited value per market, so total exposure is bounded, not only per order.
2. **Per-user open-order limit**: stops one wallet from multiplying the per-order cap.
3. **Oracle circuit breaker**: refuse execution if the Chainlink price moved more than X% since the previous round (guards against a bad feed update).
4. **Guardian role**: allow a separate key to `pause()` only (never move funds), so an incident can be stopped faster than a multisig can sign.

Users can always cancel and withdraw, even while paused. That invariant must not change.
