# Order book security review (pre-mainnet)

**Scope:** `limit-orders/contracts/LimitOrderBook.sol`, `UniswapV3Adapter.sol`, deploy scripts, keeper, and the app's transaction guard (`src/lib/limitOrders/calls.ts`).
**Date:** 2026-11-16. **Reviewer:** internal (Claude), not a third-party audit.
**Result:** 3 issues fixed, each with an attack test in `limit-orders/test/Security.test.js`. 111 contract tests pass; the mainnet-fork rehearsal passes against real Base pools and feeds.

> This is a careful internal review, not a substitute for an external audit. Keep the canary limits until one is done.

## Fixed

### H-1 · The owner could drain escrow by re-pointing a live market (High)

`setMarket` let the owner swap a market's **price feed** or **swap adapter**, or loosen its oracle bound to 50%, **instantly**. A compromised owner (or 2 colluding Safe signers) could set a fake feed reporting a tiny price plus an adapter that keeps the tokens; every triggered order would then "fill" at near zero and the tokens would be gone. The docs claimed the owner "can never move user funds", which was not true.

**Fix:** on a live market, any change that can make fills worse (new feed, new adapter, looser deviation, longer staleness) now reverts with `NeedsTimelock`. It must go through `queueRiskChange` → wait **2 days** → `applyRiskChange`, with a public `RiskChangeQueued` event. Users can cancel and withdraw during that window, and **the Trade page shows a warning banner** for any queued change. Tightening, caps, and enable/disable stay immediate.

### H-2 · Anyone could sandwich an execution atomically (High)

`executeOrder` and `executeDca` were permissionless. On Base an attacker can, in **one transaction**: flash-swap the Uniswap pool to push the price, call `executeOrder` so the user fills at the worst price the oracle floor allows, then swap back. Per fill this extracts up to the user's slippage (orders) or the full market deviation bound (recurring plans have no user minimum: up to 2–3.5%).

**Fix:** `keeperOnly` (on by default) restricts execution to allowlisted keepers (`setKeeper`). Strangers get `NotKeeper`. The owner can turn the allowlist off as a liveness fallback if the keeper is down. Also tightened crypto oracle bounds to just above their measured spread: **WETH 150 bp** (was 200), **cbBTC 100 bp** (was 200), which caps what even a compromised keeper key could extract.

### M-1 · No L2 sequencer check (Medium)

Chainlink requires L2 consumers to check the sequencer uptime feed. After a Base sequencer outage, prices can be outdated while still inside the staleness window.

**Fix:** every execution path checks Base's Sequencer Uptime Feed (`0xBCF8…6433`, verified on-chain) and waits a **1-hour grace period** after recovery (`SequencerDown`). Cancels are unaffected. Wired in by the deploy script.

## Checked and OK

| Area | Finding |
|---|---|
| Reentrancy | All state-changing user/keeper paths are `nonReentrant`; state is updated before token transfers |
| Always-exit | `cancelOrder`, `cancelDca`, `refundExpired` work while paused, after market disable, and when the sequencer is down. Escrow accounting is saturating, so it can never block a withdrawal |
| Ownership of funds | No function sends escrow to the owner, guardian or caller. `refundExpired` by a stranger pays the order owner (tested) |
| Brackets / attached exits | One deposit, released exactly once on fill, cancel or expiry (tested for every path) |
| Approvals | Adapter approval is set per swap and reset to 0; the app only approves the exact amount, never unlimited |
| Fee-on-transfer / rebasing | Rejected on deposit (`FeeOnTransferUnsupported`) |
| Overflow | Worst-case products (uint128 × uint96 × 1e18) stay below 2²⁵⁶; Solidity 0.8 checks the rest |
| Code size | 23,653 bytes with `viaIR` (limit 24,576) |
| App transaction guard | Only 10 known selectors to the order book, exact-amount approvals, no ETH value |
| Deploy | Deployer wires markets then hands ownership to a Safe (2-step); script refuses a Safe with fewer than 2 required signatures |

## Residual risks (accepted for canary, fix before scaling)

1. **No external audit.** Biggest remaining risk. Keep canary limits ($50/order, $500/market) until one is done.
2. **Escrow-ceiling griefing (Low–Medium).** Someone can fill a market's total ceiling with their own cancellable orders and block new orders (no theft). At canary ceilings this is cheap; monitor `stockEscrowed`/`quoteEscrowed`, raise ceilings, or add per-user limits later.
3. **Keeper key compromise (Low).** A stolen keeper key could sandwich within the tightened bounds (≤1–1.5% crypto, ≤3–3.5% stocks). Keep only gas money on it and rotate with `setKeeper`.
4. **Adapter pool-fee changes are not timelocked (Low).** The adapter owner (Safe) can switch a pair's fee tier instantly; damage is capped by the oracle bound. Consider moving this behind the timelock.
5. **Keeper fee changes are immediate (Low).** Max 1%, paid to the executing keeper; user minimums still protect orders.
6. **Stock tokens can't be simulated locally.** Coinbase B20 tokens use a custom precompile; first real test is the mainnet canary. Issuer pause/blacklist can block a user's own refunds.
7. **Fork test (stocks) is market-dependent.** One MSFTc bracket case reverted with `FillBelowOracleBound` because the test raises the oracle 1% while the thin 1% pool doesn't move. That is the guard protecting the user, not a bug.

## Deploy additions

- Optional `KEEPER_ADDRESS=0x…` in the deploy command allowlists the keeper wallet before ownership moves to the Safe. Otherwise the Safe calls `setKeeper(keeper, true)` once; **nothing executes until a keeper is allowlisted** (safe default).
- The keeper refuses to start if its wallet isn't allowlisted, and says how to fix it.
