# Drops on Base mainnet: runbook

The deploy itself is done **by you, from your own wallet**. Nothing here needs a private key in this
repo, in chat, or in an env file on a laptop. Everything below that can be checked by a script is.

## Where things stand

| Check | Result |
|---|---|
| Contract tests (`forge test`) | 47 pass across the repo (28 are BaseDrops), 1 skipped (the mainnet fork test, off unless `FORK_BASE=true`) |
| Mainnet fork rehearsal with the **real Circle USDC** (`FORK_BASE=true forge test --match-contract BaseDropsMainnetFork`) | 2 pass: a 100 USDC random split pays 10 + 55 + 30 + 5 exactly and leaves 0; close refunds the exact remainder |
| Live Base Sepolia run (`docs/DROPS_SEPOLIA_RESULTS.md`) | 8 of 8 scenarios, 35 steps |
| The Sepolia deployment is the same code as this repo | yes: `npm run drops:preflight -- --chain 84532 --drops 0x057e…2eAF --gate 0x06E5…2B67` matches the build |
| Production env today | Has `KV_REDIS_URL`, `SIWE_SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEYNAR_API_KEY`, `BASESCAN_API_KEY`. **Missing every Drops variable** (below) |
| External security review of `BaseDrops.sol` | **Not done** |

**Be clear about the last row.** `BaseDrops` is about 570 lines, has a reentrancy guard, rejects
fee-on-transfer tokens, and has been tested hard, but nobody outside this project has reviewed it. It
holds other people's money and can't be upgraded. A review before real volume is the single best use
of time. Until then, launch small (see "Soft launch").

## 1. Before you deploy

1. A wallet with about **0.002 ETH on Base** for gas. Use a hardware wallet (`--ledger`) or a
   Foundry keystore (`cast wallet import drops-deployer --interactive`). Never put the key in `.env`.
2. A **new** ticket-signer key, used for nothing else:
   ```powershell
   cast wallet new
   ```
   Keep the address (public) and put the private key only in Vercel as a **Sensitive** env var.
   This key signs the amount each task, lucky or split claim pays. Anyone who steals it can sign
   claims up to each drop's `maxAmountPerClaim` on drops that use it. Treat it like a hot wallet:
   Vercel Sensitive var, no copies, and move it to a KMS when volume grows.
3. A secrets key for webhook secrets and raffle seeds:
   ```powershell
   openssl rand -base64 32
   ```

## 2. Deploy

```powershell
$env:ALLOW_MAINNET = "true"
forge script script/DeployBaseDrops.s.sol --rpc-url base --ledger --broadcast --verify --verifier etherscan --etherscan-api-key <BASESCAN_KEY> --chain 8453
```

(Use `--account drops-deployer` instead of `--ledger` for a keystore.) Write down the two addresses
and the **deploy block** (in `broadcast/DeployBaseDrops.s.sol/8453/run-latest.json`).

Then prove the chain has exactly this repo's code:

```powershell
npm run drops:preflight -- --drops <BaseDrops> --gate <TokenBalanceGate>
```

All lines must say PASS (bytecode matches, `nextDropId` is 2000000001).

## 3. Rehearse on a preview first (nobody else sees it)

Set these for **one preview branch only** (not Production), as was done for Sepolia:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_DROPS_CONTRACT` | BaseDrops address |
| `NEXT_PUBLIC_DROPS_TOKEN_GATE` | TokenBalanceGate address |
| `NEXT_PUBLIC_DROPS_DEPLOY_BLOCK` | the deploy block |
| `DROPS_TICKET_SIGNER_KEY` | the new ticket-signer key (Sensitive) |
| `VOUCHER_SECRETS_KEY` | the base64 key from step 1 (Sensitive) |

(`NEXT_PUBLIC_DROPS_CHAIN_ID` stays **unset**: mainnet is the default.) Deploy the preview, then:

```powershell
npm run drops:preflight -- --drops <BaseDrops> --gate <TokenBalanceGate> --app https://<preview-url>
```

Every line must PASS, including the `app:` lines (they come from `/api/drops/status`).

### Smoke test with about $5 and two wallets of your own

- [ ] Link drop, 0.0005 ETH, 1 claim: create, open the link in a second wallet, claim, see the escrow refund on close.
- [ ] USDC drop, 2 USDC, 2 claims (one approval of exactly the budget, then create).
- [ ] Task drop with one quiz task: wrong answer refused, right answer unlocks the claim.
- [ ] Random split: 0.001 ETH over 3 cards, min 0.0001, max 0.0006. The three claims add up to 0.001 exactly.
- [ ] List a task drop in Explore, see it in the feed, remove it.
- [ ] Day plan: a task for day 1 and another for day 2; day 2's task is refused today.
- [ ] Close each drop and confirm the leftover returns to the creator wallet.
- [ ] Try each failure once: second claim, someone else's link, a claim after close.

## 4. Go live

1. Set the same five variables in **Production**, redeploy.
2. `npm run drops:preflight -- --drops … --gate … --app https://baseanalytics.app` → all PASS.
3. Hide nothing: the Drops tab and Explore are already in the app and start working.
4. Add `/api/drops/status` to an uptime monitor (it returns 503 until every setup check is green).

Optional, only if you want these task types: `X_CLIENT_ID`, `X_CLIENT_SECRET`, `DISCORD_CLIENT_ID`,
`DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`
(setup steps in `docs/DROPS_DESIGN.md` section 13). Without them those tasks simply say they aren't set up.

## Soft launch (recommended until it's reviewed)

- Tell people it is new. Start with your own drops and a few creators.
- Keep early drops small. The contract has no global cap, so the limit is your own judgement.
- Watch the first week: the `DropCreated` / `Claimed` events on Basescan and `/api/drops/status`.

## If something goes wrong

- **Switch the section off:** unset `NEXT_PUBLIC_DROPS_CONTRACT` in Production and redeploy. The UI says Drops aren't live. Money on chain is untouched.
- **A creator's funds are always theirs:** they can pause, close (unless they locked it) and, after a drop ends, recover from a lost wallet through the backup address.
- **Ticket-signer key leaked:** remove `DROPS_TICKET_SIGNER_KEY` at once (task, lucky and split claims stop). Drops already created keep the old signer on chain, so creators of those drops should close them. New drops use a new key.
- **The contract can't be changed or paused globally.** A bug fix means a new deployment and new drops; old ones keep working and can always be closed.

## Known gaps to close next

1. External review of `BaseDrops.sol` and `TokenBalanceGate.sol`.
2. Move the ticket signer to a KMS.
3. Production has no `CRON_SECRET`, so `/api/cron/price-alerts` answers 401 (unrelated to Drops, but it is broken).
4. The wider audit findings (open price alerts, the Neynar proxy, the x402 route) are tracked separately.
