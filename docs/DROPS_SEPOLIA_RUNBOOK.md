# Drops on Base Sepolia — runbook

Goal: run the whole Drops stack (contract, task checks, tickets, app UI) on Base Sepolia with test
funds before anything touches mainnet. Production stays on mainnet and is not changed by any step here.

Everything below has been rehearsed on a local fork of Base Sepolia (see "Dry run" at the end).
The real deploy needs **your** wallet: nothing here asks you to paste a private key into a file or
an env var, except the dedicated zero-balance ticket signer in step 3.

---

## 0. Before you start

- Foundry installed (`forge --version`). Windows: the official release zip from
  github.com/foundry-rs/foundry/releases works.
- A **deployer wallet** with a little Base Sepolia ETH (0.01 is plenty). Faucets: the Coinbase
  Developer Platform faucet or the Alchemy Base Sepolia faucet.
- Import it into Foundry's encrypted keystore (asks for the key and a password; nothing is written in plain text):
  ```bash
  cast wallet import drops-deployer --interactive
  ```
- An Etherscan API key (one key covers Base Sepolia through the Etherscan v2 API) to verify the source.
- Two more test wallets for claiming (e.g. a browser wallet and a Coinbase Smart Wallet), each with a
  little Sepolia ETH for gas, and some Sepolia USDC (Circle faucet) for USDC drops.

## 1. Deploy the contracts

```bash
forge script script/DeployBaseDrops.s.sol --rpc-url base_sepolia --account drops-deployer --broadcast --verify --verifier etherscan --etherscan-api-key <ETHERSCAN_API_KEY> --chain 84532
```

The script refuses mainnet unless `ALLOW_MAINNET=true`. Write down:
- `BaseDrops` address → `NEXT_PUBLIC_DROPS_CONTRACT`
- `TokenBalanceGate` address → `NEXT_PUBLIC_DROPS_TOKEN_GATE`
- the deploy block (shown in `broadcast/DeployBaseDrops.s.sol/84532/run-latest.json`, or on sepolia.basescan.org)
  → `NEXT_PUBLIC_DROPS_DEPLOY_BLOCK`

Check both contracts show "Verified" on sepolia.basescan.org.

## 2. Quick contract smoke test (optional, 1 minute)

Creates a 2-claim, 0.0001 ETH link drop and prints its claim link:

```bash
DROPS=<BaseDrops address> APP_URL=https://<your-preview-url> forge script script/SmokeBaseDrops.s.sol --rpc-url base_sepolia --account drops-deployer --broadcast
```

## 3. Ticket signer (for task drops)

Make a **new** key that never holds funds. It only signs tickets after tasks pass:

```bash
cast wallet new
```

Put its private key in Vercel as `DROPS_TICKET_SIGNER_KEY` (**Preview** environment only). Its
address is shown at `/api/drops/catalog` on the preview deployment. Never reuse the deployer or any funded key.

## 4. Preview deployment settings (Vercel → Settings → Environment Variables → Preview)

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_DROPS_CHAIN_ID` | `84532` (switches only Drops to Base Sepolia) |
| `NEXT_PUBLIC_DROPS_CONTRACT` | BaseDrops address from step 1 |
| `NEXT_PUBLIC_DROPS_TOKEN_GATE` | TokenBalanceGate address from step 1 |
| `NEXT_PUBLIC_DROPS_DEPLOY_BLOCK` | deploy block from step 1 |
| `DROPS_TICKET_SIGNER_KEY` | key from step 3 |
| `VOUCHER_SECRETS_KEY` | `openssl rand -base64 32` (private vault / saved links encryption) |
| `NEYNAR_API_KEY`, `BASESCAN_API_KEY` | already used elsewhere in the app; needed for Farcaster and trade tasks |

Optional: `NEXT_PUBLIC_DROPS_RPC_URL` for a dedicated Sepolia RPC (default `https://sepolia.base.org`).

Redeploy the preview. `/drops` should show the yellow "Test network" banner. Production must **not**
have `NEXT_PUBLIC_DROPS_CHAIN_ID` set.

## 5. Test checklist (tick each one)

Use the preview URL. Claim with wallets **other than** the creator.

**Create (one of each preset)**
- [ ] Gift a friend (ETH): link claims once; a second claim is refused.
- [ ] Group gift (USDC, 3 claims): wallet asks to approve **exactly** the total, then create; 3 different wallets claim; the 4th sees "everything claimed".
- [ ] Gift cards (3 codes): CSV downloads; each code works once; a used code is refused for everyone.
- [ ] Daily faucet (cooldown 1h for testing): claim, see "claim again in …", claim again after the hour.
- [ ] Holder airdrop with a token you hold / don't hold, and with a pasted list (on / off the list).
- [ ] Community quest with: quiz, secret word, X post, Farcaster follow, token balance.
- [ ] Daily quest: a "redo every claim" task must be done again before the second claim.

**Claim and safety**
- [ ] Open a link drop with the key removed from the URL: page says the key is missing.
- [ ] Coinbase Smart Wallet / Base App claim works (batched calls on Sepolia, no sponsor).
- [ ] Task check while signed out asks for sign-in; quiz attempts run out after the limit.
- [ ] Claim after a task stops being true (sell the held token): the ticket is refused.

**Manage and recover (My drops)**
- [ ] Pause → claims refused → resume.
- [ ] Make a new link: the old link stops working, the new one works.
- [ ] Add 7 days; add funds.
- [ ] Move the drop to another wallet; accept it there; close from the new wallet → refund arrives there.
- [ ] Locked drop: close is blocked until it ends.
- [ ] Private backup: turn on in My Cards, open My drops in another browser, unlock with the phrase, links appear.

**Record** each tx hash and anything confusing in the PR or an issue.

## 6. After Sepolia

1. Fix anything the checklist found.
2. External review of `contracts/drops/BaseDrops.sol` and `TokenBalanceGate.sol`.
3. Mainnet: deploy with `ALLOW_MAINNET=true`, set the same variables in **Production** without
   `NEXT_PUBLIC_DROPS_CHAIN_ID`, and use a separate mainnet ticket signer key.

---

## Dry run (done, 2026-11-19)

Rehearsed on a local Anvil fork of Base Sepolia (block ~60.68M) with Anvil's unlocked dev accounts:

1. `DeployBaseDrops.s.sol` → BaseDrops + TokenBalanceGate deployed on chain 84532.
2. `SmokeBaseDrops.s.sol` → drop `2000000001` created (2 × 0.0001 ETH), claim link printed.
3. Claim from a second account with a signature from that link key → `status 1 (success)`, claimer
   received 0.0001 ETH (minus gas); the contract then reports "Wallet claim limit reached" for that
   wallet, and a second claim is refused.
4. The app's read code (`readDropView`, `readWalletStatus` in Sepolia mode) read the forked drop
   correctly: 1 claimed, the claimer blocked, a fresh wallet allowed.

Not covered by the dry run: real wallets in the browser (the preview pane can't reach a local fork),
and the task checks against live Neynar / X. That's what step 5 is for.
