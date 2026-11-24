# Plan rules (Layer 2 of Invest Plans)

Rules let the owner of a recurring-buy plan say **when** it may run: only on chosen weekdays, only in a
time window (for example the first hour after the US market opens), only on a dip, or skip after a big
run-up. The keeper applies them before it sends a run.

## What a rule can and cannot do

A rule can only make a due run **wait**. It cannot change an amount, a fee, a destination, or speed a run
up. The plan's money, price ceiling and cancel button stay on-chain and are untouched. The contract
still enforces its own timing (the interval) and a fresh price feed, so nothing runs on weekends
whatever the rules say.

## How it works

1. The plan owner picks rules in the plan card ("Add rules"). The app shows them in plain English.
2. The owner signs a text message (no gas) that contains the chain, the order-book address, the plan id,
   the rules in plain words and the exact rules data, and a timestamp.
3. `POST /api/plans/rules` checks, in this order: the shape and ranges of the rules, the timestamp (within
   10 minutes), that the plan exists and is still open **on-chain**, that the signature is valid for the
   plan's on-chain owner (smart-contract wallets included), and that it is newer than anything stored.
   Then it stores the rules in Redis.
4. The keeper (`limit-orders/keeper/rulesFilter.ts`) fetches the rules for its open plans once a minute
   with a shared token, **re-checks every signature itself**, and before each due run asks the shared
   rule engine (`limit-orders/shared/planRules.ts`, the same code the app uses) whether it may go ahead.

## Threat model

| Threat | What happens |
| --- | --- |
| Someone saves rules for a plan they do not own | The signature must be from the plan's on-chain owner. Refused (401). |
| Someone changes the rules after the owner signed | The signed text includes the exact rules, so the signature no longer matches. Refused. |
| An old signature is replayed (even to restore old rules) | The timestamp must be recent and newer than the stored one. Refused (409). |
| A signature is copied to another plan, order book or chain | Plan id, order book and chain are inside the signed text. Refused. |
| The Redis store or the API is tampered with to hold back plans | The keeper checks each signature itself and ignores any entry that fails. Plans run as if they had no rules. |
| The API is down | The keeper keeps using the rules it already knows. Plans it knows nothing about run as before. |
| The token for the keeper's bulk read leaks | An attacker can read signed rules (the rules are not secret money data). They cannot write or change anything. |
| Hostile or huge input | Strict validation, unknown keys refused, 4 KB body limit, rate limits, plan ids and counts bounded. |
| A rule that is never met (for example a 50% dip) | The plan waits. The owner can change the rules or cancel for a refund at any time. The UI warns about this. |
| Price history unavailable for a price rule | The run waits (fails closed). It is never sent blind. |
| The keeper is down | All runs are delayed, rules or not. This is the existing single-keeper risk, not a new one. |

Accepted limits:
- A rule set that fails its signature check is ignored, so the plan runs on its schedule. This is the
  safe direction (a forged rule can never block a plan), but it means the owner's intended wait is not
  applied in that case.
- The keeper trusts one price-history source (DefiLlama) for dip and skip rules and one price from the
  contract. Both are checked for sanity (finite, positive), not cross-checked against a second source.
- Times use the US Eastern clock, including daylight saving.

## Turning it on

Nothing changes until both sides are configured.

- App (Vercel): set `KEEPER_RULES_TOKEN` to a random value of 32 or more characters. Redis (`KV_REDIS_URL`)
  must be set, as it already is for other features.
- Keeper (Railway): set `KEEPER_RULES_URL=https://<your-domain>/api/plans/rules` and the same
  `KEEPER_RULES_TOKEN`. The keeper log then says `plan rules on`.
- Last, set `NEXT_PUBLIC_PLAN_RULES_ENABLED=true` on the app. This is what shows the Rules editor on plans.
  It stays hidden until you do, because rules saved before the keeper is configured would not be applied.
- Optional: `KEEPER_RULES_REFRESH_MS` (default 60000).

## How it was tested

- `test/limitOrders/plan-rules.test.ts`: rule validation (including hostile input), the plain-English text,
  the US Eastern clock around daylight-saving changes, every rule type and its edges.
- `test/limitOrders/plan-rules-service.test.ts`: real signatures from real keys: wrong signer, swapped rules,
  other plan or chain, stale or future time, replay, finished plans, removal, storage failure; and the
  keeper-side authenticity check.
- `test/limitOrders/plan-rules-route.test.ts`: the HTTP route (size limit, token, public vs keeper reads).
- `test/limitOrders/keeper-rules-filter.test.ts`: the keeper filter with injected dependencies (outage,
  refresh limit, history cache, fail-closed behaviour, tampered entries).
- `limit-orders/scripts/e2e/e2e-plan-rules.ts`: the **real keeper** against the **real order-book contract** on
  a local chain with a mock rules server and real signatures: a signed rule holds a due plan; a tampered
  rule is ignored; a plan without rules runs; a new signed rule releases the held plan; a rule copied onto
  another plan is ignored. Run with `npx tsx scripts/e2e/e2e-plan-rules.ts` inside `limit-orders/` after
  `npm run compile`.
