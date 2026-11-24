# Invest Plans: research and design

Status: proposal, nothing built yet. Written 2026-11-24.

Goal: let someone put money into stocks the way they actually want to (many stocks, over time, on a
schedule, on dips) without watching the screen, and without us holding more risk than we already do.

## 1. What people actually want (the full list)

**When**
- Every day, week, two weeks, month.
- A specific weekday or day of the month ("every Tuesday", "on the 1st").
- At or just after the market opens, or at a set time.
- Only when the market is open (tokenized-stock prices freeze outside US hours).

**How much**
- A fixed amount each time.
- A lump sum spread over N weeks ("phase-in").
- Buy more when the price is lower ("boost on dips"). Value averaging is the formal version.
- Step up over time (invest $50, then $60, ...).

**Under what condition**
- Only if the price is at or below a level (a ceiling).
- Buy the dip: when the price falls X% from a reference (7-day high, 30-day high, last buy).
- Skip a run if the price is up more than Y% (do not chase).
- Stop when the budget, a share target or a target allocation is reached.

**Across what**
- One stock, or a basket of up to ~10 with weights.
- Send new money to whatever is below its target share first. This is the cheapest kind of
  rebalancing, because it needs no selling.
- Rebalance on a schedule or when drift passes a threshold.

**On the way out**
- Take-profit and stop-loss on each buy.
- Scale out: sell a little each week.
- Trailing stop.

**Guardrails**
- Total budget cap, price ceiling, pause or cancel any time and get the unspent money back.

## 2. What the research says

- **DCA does not beat investing a lump sum on average.** Vanguard found lump-sum investing ahead of a
  three-month cost-averaging split in about two-thirds of historical periods (68% in the 2023
  follow-up on 1976 to 2022 data). The advantage grows with the horizon. DCA is a way to manage regret
  and risk, and it is simply how people with a salary invest. We should say this in the product and not
  promise better returns. Sources: [Vanguard summary, smartcashflow](https://smartcashflow.org/posts/lump-sum-vs-dca-vanguard-study/),
  [Vanguard-based overview, ftmarketwatch](https://ftmarketwatch.com/research/dollar-cost-averaging-vs-lump-sum-vanguard.html).
  The figures vary a little between secondary sources; the primary Vanguard papers are the ones to cite
  before we publish any number.
- **Value averaging and dip rules are contested.** Some studies find a small edge for value averaging at
  long horizons, others argue the edge is a mathematical illusion, and the mean-reversion idea behind
  "buy the dip" is disputed. I found no solid backtest of a pure buy-the-dip rule. These should be
  offered as options, labelled as unproven, never as the default. Sources:
  [value averaging overview](https://en.wikipedia.org/wiki/Value_averaging),
  [critique](https://wtop.com/news/2017/09/value-averaging-an-investing-strategy-to-avoid).
- **Brokers set the bar at: $1 minimums and daily, weekly, two-weekly or monthly schedules.** Robinhood
  reported daily/weekly/bi-weekly/monthly recurring buys from $1 in 2019, and Public advertises $1
  inside recurring plans. Those facts are dated, so re-check the apps. I could not confirm anywhere
  whether scheduled orders fill at the market open. Sources:
  [Robinhood newsroom](https://robinhood.com/newsroom/fractional-shares-and-more-new-ways-to-invest/),
  [broker comparison](https://www.stockbrokers.com/guides/fractional-shares-brokers).
- **Tokenized stocks have their own timing risk.** Base's docs say the token's NAV reference is a
  Chainlink-based price that is not a live bid or ask, and that the DEX price does not feed it
  ([Base docs](https://docs.base.org/specifications/b20/tokenized-stocks-on-base)). Early reports show
  weekend moves of about 0.4% to 0.6% ([CryptoSlate](https://cryptoslate.com/coinbase-stock-tokens-stayed-within-0-6-of-friday-prices-through-the-weekend-as-aave-collateral-remained-pending/)),
  but also cases of the token pricing an earnings result while Nasdaq was closed
  ([Unchained](https://unchainedcrypto.com/tokenized-nvidia-priced-its-earnings-while-the-nasdaq-was-closed-aerodromes-ceo-says/))
  and warnings about "ghost" prices when an oracle is frozen
  ([crypto.news](https://crypto.news/tokenized-stocks-face-24-7-pricing-gap-redstone-coo/)). Our order
  book refuses to run when the feed is older than 25 hours, which blocks weekends. That is a feature
  for scheduled buying.
- **Dividends are handled through a multiplier**, not as cash (Base docs). Our portfolio maths uses
  price times balance. Before any cost-basis or "average price" feature ships, check how the
  multiplier changes the balance or the price, or the numbers will be wrong.

## 3. What our contract and keeper do today

Read from `limit-orders/contracts/LimitOrderBook.sol`, `limit-orders/keeper/keeper.ts` and
`limit-orders/config/mainnet-step2.json`.

| Capability | Today |
| --- | --- |
| Recurring buy | Yes: `createDca(stock, amountPerBuy, buys, interval, maxPrice)` |
| Recurring sell (scale out) | Yes: `createDcaSell(..., minPrice)` |
| Stocks per plan | One |
| Runs per plan | Up to 365; minimum gap 1 hour; first run is immediate |
| Schedule | A fixed gap after each run. No weekday, no time of day, no market-open rule |
| Price rule | An absolute ceiling (buy) or floor (sell), fixed at creation. A run that fails it waits and retries |
| Dip rule relative to a reference | No |
| Variable amount (value averaging, boost) | No, the amount is fixed |
| Pause or resume | No, only cancel (refunds the unspent money) |
| Edit a plan | No |
| Buy with attached take-profit and stop-loss | Yes, for single limit buys (`createLimitBuyWithExits`), not for plan runs |
| Who executes | Allowlisted keeper only (this blocks sandwich attacks) |
| Weekend or stale price | Blocked automatically (feed older than 25 hours) |
| Cost per run | Keeper fee 0.10% of the stock bought, plus the 0.3% pool fee, plus price impact |
| Money | All of `amount x runs` is escrowed in the contract at creation |
| Beta limits (deployed on mainnet now, canary config) | A plan's total can be at most `maxQuoteIn` = 50 USDC per market, and escrow per market is capped at 500 USDC. The step-2 Safe proposal raises these to 250 and 2,500 |

What follows: the order book is already deployed on Base mainnet (`limit-orders/deployments/base-mainnet.json`,
deployed 2026-11-21 from this source, which includes recurring buys and sells), so Layer 1 can run on
mainnet today. The limit is the beta cap: one plan can invest at most $50 in total right now ($250 after the
step-2 Safe transaction), so "10 stocks over months" is many small plans until the caps are raised.
The app only hides the Recurring tab when its mainnet order-book address setting is missing from the
environment (this is what a local run without that setting shows), not because of the contract.

## 4. Proposed product: Invest Plans

One screen where a person describes a plan in plain words and sees what will happen before signing.

### Layer 1: ships on the existing contract (no new audit)

- **Plan composer.** Pick up to 10 stocks with weights (start from a basket, or from the target mix in
  My Stocks). Pick a total budget, how long, and how often (daily, weekly, every two weeks, monthly).
  It creates one `createDca` per stock. Smart wallets confirm once (atomic batch); other wallets get
  one USDC approval for the total and one confirmation per stock, with clear progress and a resume
  if something fails halfway.
- **Presets:** "Weekly basket", "Phase in a lump sum over N weeks", "Core plus dip boost" (a second plan
  per stock whose ceiling sits a chosen percent below today's price, so it only fills on a dip),
  "Scale out" (recurring sell with a floor).
- **Honest preview:** the schedule, how many runs, cost per run and in total, what a feed freeze does
  (runs wait, they are not lost), and an "invest now vs spread" note that states the Vanguard result.
  It warns when fees would exceed 1% of the budget (many tiny daily buys).
- **Plans dashboard:** progress, runs done, average buy price (after the multiplier check above), next
  run, unspent money, cancel with refund.

Known weakness: the dip-boost ceiling is an absolute price fixed at creation. If the stock rallies, the
boost plan never fills. The preview must say so.

### Layer 2: keeper-side smart rules (no contract change, needs a security review)

Rules the keeper applies before it calls `executeDca`: only on chosen weekdays, in a time window
(including "just after the market opens"), only if down X% from the 7 or 30-day high, skip if up
more than Y%. The user signs the rules once (a signed message), the keeper verifies the signature,
and the rules can only delay or skip a run. They can never change an amount, a destination or a fee,
so a bad rule or a keeper bug costs timing, not money. Plan money, ceiling and cancel stay on-chain.
Weakness: the keeper is one operator, and a keeper outage delays every plan. We should run a second
keeper and show "next run window" honestly.

### Layer 3: contract v2 (needs its own audit and a Safe deployment)

Variable amounts per run (value averaging, boost on dips), a ceiling relative to a reference price,
pause and resume, top-up and edit, one atomic multi-stock basket plan, attached take-profit and
stop-loss on plan runs, plan expiry. This is where the real power is, and the real risk.

## 5. Risks and rules we should hold to

- No promise of returns. Show the lump-sum-wins result next to DCA.
- The keeper stays bounded: a fee cap on-chain, executes only after the interval and only on a fresh feed.
- Region and eligibility checks apply to plans exactly as to swaps (these tokens are for eligible
  non-US users).
- Escrow means the contract holds user money for the plan's life. That concentration is the main
  risk of the whole feature, so plan caps stay small until audits and a longer track record exist.
- Builder-code attribution on every plan transaction, as everywhere else.
- Tiny recurring buys lose money to fees. Set a minimum per run and a fee warning.

## 6. Build order and what we need

1. Layer 1 plan composer and dashboard (about a week of work; testable on Sepolia now).
2. Re-check broker features and the Vanguard primary papers before any public wording.
3. Layer 2 rules, after a short threat-model note (what a malicious rule or a malicious keeper can do).
4. Layer 3 only if Layers 1 and 2 are used enough to justify an audit.

Needed from the owner:
- Raise the per-plan and escrow caps with the step-2 Safe proposal in `limit-orders/proposals`. At the
  current $50 per plan, Layer 1 works on mainnet but only for small plans. Sepolia (the test network with
  fake money) is where it gets tested first.
- Decide whether value averaging and dip rules are offered at all, given the evidence.
- Decide who runs a second keeper.
