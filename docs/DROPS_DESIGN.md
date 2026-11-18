# Drops — design for safer My Cards and rule-based vouchers

Status: proposal, nothing built yet. Written 2026-11-18 against `main` @ `1f8fd1f`.

"Drops" is the working name for the new section: one place where a creator funds a pot of
ETH / USDC / tokens / tokenized stocks and decides **who** can take from it, **how often**,
and **what they must do first**. Today's gift cards and one-link gifts become two presets of it.

---

## 1. How My Cards works today

There are two products, two contracts and two different secret-storage models.

| | Gift cards (`BaseVoucher`) | One-link gifts (`BaseVoucherCampaign` v2/v3) |
|---|---|---|
| Contract | `contracts/BaseVoucher.sol`, v1 `0xE425…Cf25`, v2 `0xc118…8fce` | `contracts/BaseVoucherCampaign.sol`, v3 ids from 1,000,000,001 |
| Secret | one random secret per card, `keccak(secret)` stored onchain | one random link key per campaign, its address stored onchain |
| Where the secret is kept | **server**: Redis + disk, plaintext, keyed by creator address (`lib/voucher/credentials-store.ts`) | **browser only**: `localStorage` (`VoucherCampaignPanel.tsx`) |
| Who can read it back | anyone with a SIWE session for the creator address | only that browser |
| Lost secret → | reclaim only after expiry; **no expiry = funds locked forever** | creator can `close()` and get refunded (unless `committed`) |
| Wallet changes / lost | the batch stays tied to the old creator address forever | same |
| New contract | `VOUCHER_CONTRACT` env swap; old ids are re-read by trying each contract in turn | id range tells the contract (`campaign-contracts.ts`) — good |

## 2. Problems found (ordered by severity)

1. **Anyone can overwrite a creator's saved card secrets.** `POST /api/vouchers/credentials`
   has no SIWE check, and it never checks the secrets against the onchain hashes
   (`verifyBatchCredentials` exists but nothing calls it). `upsertCreatorBatch` takes a
   non-empty incoming secret over the stored one. So anyone can make a creator's My Cards show
   wrong claim links. They can't steal funds this way, but the creator can lose the real
   links for good.
2. **Card secrets are stored in plaintext on the server.** Anyone who can read Redis (a leaked
   `REDIS_URL`, a provider breach, or a logged value) can claim every unclaimed card for every
   creator. These secrets are bearer instruments.
3. **Batch ids collide across contracts.** v1 and v2 both count from 1. `readOnchainBatch(id)`
   returns the first contract that has that id, and stored credentials are keyed by `batchId`
   alone. After a contract change, batch #5 on v2 can show v1 batch #5's status, or get
   matched to the wrong secrets.
4. **No-expiry card batches can lock funds forever.** `reclaimUnredeemed` needs `expiresAt > 0`.
   If a creator loses the secrets of a batch with no expiry, nobody can ever recover the funds.
5. **One-link keys live in one browser.** If the creator clears their browser or switches device,
   they can't re-share the link. They can only cancel (refund), and a `committed` campaign can't
   be cancelled until it expires.
6. **The wallet address is the only identity, with no migration path.** If a creator moves to a
   new wallet (lost device, switching from an EOA to a smart wallet), nothing can move a batch or
   campaign over. A refund always goes to the old address.
7. **The credentials GET makes one RPC read per batch, one batch at a time** (each read tries up
   to 2 contracts). That's slow and burns the RPC budget for creators with many batches.

## 3. Recovery model (the answer to "how do we recover when the contract changes")

Three layers. Each one works even if the others fail.

### 3.1 Onchain: the creator can always repair a campaign without any secret
New contract functions, creator-only:
- `rotateLinkKey(id, newLinkSigner)`: lost the link → make a new one, and the old link stops working.
- `transferCreator(id, newCreator)` + `acceptCreator(id)`: two steps, so a typo can't brick it.
  Moves a campaign (and its refunds) to a new wallet.
- `setManager(id, manager, bool)`: optional second wallet (or a team wallet) that can pause and
  rotate keys, but **can never withdraw**. Withdrawals always go to the creator.
- Every campaign gets an expiry or a `reclaimAfter` date. The new contract has no "locked forever" state.

With these, losing every secret costs at most a re-share. Funds are never stuck.

### 3.2 Offchain: secrets are encrypted before they leave the browser
- When a creator first creates a drop, the browser makes a random 256-bit **vault key**.
- All secrets (card secrets, link keys) are encrypted with AES-GCM using that key. The server
  stores only the encrypted data, keyed by `chainId:contract:id`, behind a SIWE session check.
- The vault key itself is stored only in wrapped (encrypted) form, two ways:
  - **Recovery phrase:** shown once (12 words, or a downloadable file). It works on any device and any wallet type.
  - **Wallet unlock (EOA only):** a key derived from a deterministic `personal_sign` of a fixed
    message. This works for MetaMask/Rabby-style EOAs, so re-signing on a new device unlocks the vault.
    **It does not work for Coinbase Smart Wallet / passkeys**, because their signatures are
    randomised each time. That's why the recovery phrase is the main path, not wallet unlock.
- Result: if Redis leaks, the attacker gets only encrypted data. If the browser is lost, the
  creator recovers with the phrase (or by re-signing with an EOA). If even the phrase is lost,
  §3.1 still saves the funds.

### 3.3 Contract changes without breaking anything
- **The core escrow stays immutable.** No upgradeable proxy holds user funds. Upgrades can't rug
  creators, and audits stay valid.
- **Contract registry.** One config list `{address, version, firstId, kind, abi}` replaces the
  scattered `VOUCHER_CONTRACT` / `CAMPAIGN_CONTRACT(_LEGACY)` / hard-coded v1/v2 constants.
  Each new contract starts its ids in a new range (as v3 does today), so a link's id alone picks the contract.
  The registry also has a function that answers "every contract this creator has used".
- **Every stored record is keyed by `chainId:contract:id`**, never by id alone.
- **Rules are plugins, not core code** (§5). Most new task types need zero contract changes.
  A new onchain rule ships as a new *gate module* that new drops can point at. Existing drops
  keep their own module forever.
- **Retiring a contract:** stop creating on it, and keep reading, claiming and refunding on it.
  The app does this already for v2 (`isRetiredCampaignContract`); the registry makes it standard.

## 4. What creators can configure

All of these are optional and combine freely:

**Who can claim**
- Anyone with the link (today's one-link)
- Specific people (unique per-card codes, today's gift cards)
- Allowlist: paste addresses or upload a CSV → Merkle root onchain, so even large lists are cheap
- Holders: own ≥ X of a token / NFT / tokenized stock / Beefy vault share
- Basename holders, or a specific `.base.eth` set
- Coinbase Verified Account / Verified Country (EAS attestations on Base): the strongest cheap sybil filter
- Farcaster: has an FID, follows @x, recasted or liked a cast, is a member of a channel
- Wallet reputation: wallet age ≥ N days, ≥ N transactions, holds ≥ $X
- Region rules (exist today for tokenized stocks)

**How often**
- Once per wallet (today)
- Up to N times per wallet
- Cooldown: once every 24h (or any number of hours), measured from that wallet's last claim
- Daily drop: once per calendar day (UTC), with a cap on claims per day for the whole drop
- Streaks: claim on consecutive days → a bonus multiplier (e.g. day 7 pays 2×)
- Total budget cap, plus an optional per-day budget so the pot can't empty in one hour

**What they get**
- Fixed amount per claim (today)
- Tiered amounts by tasks completed (e.g. base + bonus for optional tasks)
- Random amount in a range (lucky-envelope style), using fair onchain randomness
- Raffle: everyone enters by a deadline, then N winners are drawn fairly (commit-reveal over
  `prevrandao`). Losers pay nothing beyond gas.
- Referral bonus: a claimer gets their own invite link; the inviter earns X per friend who claims (capped)

**What they must do first (tasks)**: the full catalog, how each task is verified, what it
costs to run, and how people cheat at it, is in §4A.

"Reveal a key after tasks" is exactly this flow. Once every required task passes, the server
issues a signed EIP-712 *ticket* for that one wallet, which the contract checks. A wallet that
skips the tasks never gets a ticket, and a ticket is useless to any other wallet. (The link key +
ticket design already exists in v3; this extends it.)

**Presets** (so creating a drop stays a 3-tap flow)
- Gift a friend (1 claim, secret link)
- Group gift (first N wallets, one link) — today's one-link
- Gift cards (N unique codes) — today's cards, moved onto the new contract
- Daily faucet (once per 24h per wallet, daily cap)
- Community quest (tasks → claim, optional streak bonus)
- Holder airdrop (allowlist or token-gated)
- Raffle (enter, then N winners)

## 4A. Task catalog

### How much each kind of check can be trusted
Every task shows its level to both the creator and the claimer, so nobody mistakes an
honour-system task for a verified one.

| Level | Meaning | Example |
|---|---|---|
| **Onchain-enforced** | The contract itself checks it during the claim tx. Nothing can fake it. | holds ≥ 100 USDC, on allowlist |
| **Verified** | Our server checks public onchain or API data, then signs the claim ticket | swapped $50 of a token since Monday |
| **Account-linked** | The claimer signs in to the platform (OAuth / bot), and we read it as them | in Discord server, starred GitHub repo |
| **Proof-posted** | The claimer posts public proof containing a code unique to their wallet | tweet containing `drop-7Q2K` |
| **Creator-reviewed** | The claimer submits something, and the creator approves or rejects it in My Drops | "make a meme", "write a thread" |
| **Honour** | We can't verify it. It's labelled as such and can't be the only gate on a drop over a set size | "visit our site" |

### Building blocks (these make "anything" possible)
The named tasks below are presets of five generic tasks. Anything a creator can describe usually fits one of them,
without new code:

1. **Onchain event**: contract + event signature + which topic must be the claimer + minimum
   value/count + time window. Examples: "emitted `Deposit` on vault X with amount ≥ 1e18 since block N",
   "minted from this NFT contract", "voted on this governor".
2. **Contract read**: call any view function with the claimer's address and compare the result
   (`≥ / ≤ / == / != 0`). Examples: staked balance, veAERO voting power, Morpho position, lending health.
   Can run onchain (gate module) or on the server.
3. **API check**: the creator's own HTTPS endpoint gets `{wallet, dropId}` and answers with a reply
   signed by a key they registered (game score, course completion, a CRM).
4. **Proof submission**: the claimer pastes a URL or text. It gets auto-checked (pattern match, oEmbed) or goes to creator review.
5. **Secret / quiz**: answers stored as salted hashes. Covers event codes, puzzles, learn-to-earn quizzes.

### Trading and DeFi tasks (what most crypto creators will want)

| Task | Verification | Notes / anti-cheat |
|---|---|---|
| Buy ≥ $X of token T (memecoin, launchpad token, Zora coin, tokenized stock) | Verified: incoming `Transfer` of T to the wallet in a tx that touches a known DEX router/pool, after the drop's start block. USD = amount × price at that block (DexScreener / pool reserves) | count **net** buys (bought − sold); ignore plain transfers from other wallets |
| Buy and **hold** for N hours/days | snapshot at buy + balance ≥ X at claim + no outgoing `Transfer` of T in between | stops buy → claim → dump. Optional onchain re-check at claim (gate module) |
| Trade volume ≥ $X (any token or a list) | sum swap legs in the window | min trade size + max N trades counted, so wash-trading dust doesn't count; flag self-loops |
| Trade **through this app** | builder code (`BUILDER_CODE`, ERC-8021 suffix) in the tx calldata | strongest trading proof; zero external API cost |
| First trade of token T / be in the first N buyers | first matching buy event per wallet ordered by block | launch campaigns |
| Hold ≥ X of token / NFT / stock / vault share | `balanceOf` / ERC-1155 / ERC-4626 | onchain-enforced at claim; flash-loan proof because it's read in the claim tx, and can require holding since a snapshot block |
| Provide liquidity (Aerodrome, Uniswap v3/v4, Beefy) ≥ $X for N days | LP token / position NFT reads + `Mint`/`Deposit` events | value with the LP math from `lib/lending/user-positions.ts` |
| Supply / borrow on Aave, Morpho, Moonwell ≥ $X | contract read (aToken/mToken/Morpho position) | |
| Stake / lock (veAERO, staking contracts), vote in a gauge or governor | contract read / `Vote` event | |
| Bridge ≥ $X to Base | deposit events on the canonical bridge / Across / Relay for the wallet | |
| Place a limit order / use a feature of this app | the app's own records + onchain order events | |
| Launch a token on the launchpad / buy a launchpad token | launchpad events (already indexed by the app) | |
| Mint an NFT / hold N from a collection / list on a marketplace | `Transfer` from 0x0 / balance / marketplace events | |
| Make a payment / tip / send ≥ X to address A | `Transfer` / native value to A | merchant and donation drops |

**Compliance guard:** a task that pays people to buy a **tokenized stock** follows the same region
rules and kill switch as stock claims today. Any drop that requires a purchase is labelled
"Requires a purchase · sponsored by @creator". A raffle that needs a purchase must offer a free
entry path. In many places a raffle without one counts as a lottery.

### Social tasks

| Platform | Tasks | Verification | Cost / limits |
|---|---|---|---|
| **X (Twitter)** | post / quote / reply containing a code or hashtag, mention @x | **Proof-posted, free:** the claimer pastes the tweet URL. The server reads the public oEmbed (`publish.twitter.com/oembed`) and checks author handle + text + the wallet's unique code. The first such tweet also proves the X account ↔ wallet link. | free; only works for public posts |
| X | follow @x, like / repost a post, account age ≥ N days, followers ≥ N | **Account-linked:** X OAuth 2.0 (user context, `follows.read like.read tweet.read users.read`). Read as the user: their following list, likes, reposts. | **needs a paid X API tier.** Likes are private since 2024, so only the user's own token can see them. Off by default behind a flag; the creator can still pick "honour system" for these |
| **Farcaster** | follow, like, recast, reply, quote, cast containing text, channel member, Neynar user score ≥ N, power badge, add / open a mini app, notifications on | Neynar API (already in `lib/api/neynar.ts`) + Farcaster sign-in (already in `lib/auth/farcaster-siwe-server.ts`) | existing Neynar plan; cache results |
| **Telegram** | join group / channel, stay N days | the creator adds our bot as admin, the claimer links via Telegram Login, then `getChatMember` | free |
| **Discord** | join server, have role R, member for N days | Discord OAuth `guilds.members.read` | free |
| **GitHub** | star / fork repo, follow, merged PR, contributor | GitHub OAuth / public API | free |
| **YouTube** | subscribe to channel | Google OAuth `youtube.readonly` | free quota |
| **Email** | verify an email, join a newsletter | magic link | email provider cost |
| **Zora / Base App** | buy a creator coin, mint a post | onchain (trading tasks above) | free |

**One account, one wallet:** each linked X / Farcaster / Discord / Telegram / GitHub account can
back exactly one wallet per drop (stored both ways in Redis). Otherwise one person with ten
wallets just re-uses their single X account.

### Identity and anti-sybil tasks

| Task | Verification |
|---|---|
| Coinbase Verified Account / Verified Country / Coinbase One | EAS attestations on Base (onchain) |
| Basename / ENS name | resolver reads |
| Proof of personhood: World ID, Human Passport (Gitcoin) score ≥ N | their verifier APIs / onchain attestations |
| Builder reputation: Talent Protocol score ≥ N | API |
| Guild.xyz role, POAP held | API / onchain |
| Wallet age ≥ N days, ≥ N transactions, active on ≥ N different days, has spent ≥ X on gas, portfolio ≥ $X | RPC + explorer API (cached per wallet) |
| Not on a blocklist (the creator's own list, plus known sybil clusters) | server check |

### Engagement and app tasks
- **Daily check-in**: sign one message per day (free, no gas). Builds streaks.
- **Streaks**: N days in a row of any task set. A missed day resets it (the creator can allow 1 freeze).
- **Referral**: invite N friends who complete the drop. Counted only when the friend passes every check, so fake invites earn nothing.
- **Learn-to-earn quiz**: N questions, pass mark, limited retries, answers hashed.
- **IRL event check-in**: a rotating 6-digit code (changes every 30s) shown on the creator's screen or a QR. Proves the person was there.
- **Complete another drop / claim N drops**: chain drops into campaigns.
- **Creator-reviewed submission**: memes, threads, videos, bug reports, with an approve/reject queue in My Drops.

### Combining tasks
- Each task is **required** or **optional**. Groups support AND / OR ("follow on X **or** Farcaster").
- **Points mode**: every task is worth points, and the claim unlocks at ≥ N points. The reward can scale with points (tiered amounts).
- **Order**: a task can require another to be done first (e.g. "link X" before "post on X").
- **Repeat**: per-period tasks reset every day/week, for daily drops ("swap $10 today").
- **Re-check at claim**: holding and membership tasks are checked again right before the ticket is
  signed, so "join → get credit → leave" doesn't work.

### How people cheat, and what stops them

| Attack | Defence |
|---|---|
| Many wallets, one person (sybil) | identity tasks; one linked social account per wallet; wallet age / activity minimums; per-drop daily caps |
| Borrow tokens just for the balance check (flash loan / quick transfer) | balance is read in the claim tx itself, plus "held since snapshot block" |
| Buy, claim, dump | hold-for-N tasks; optional vesting (claim pays in parts) |
| Wash-trade volume | net-buy accounting, min trade size, cap on counted trades, ignore self-loops |
| Bot social accounts | X account age / followers, Neynar user score, power badge |
| Shared quiz answers or event codes | rotating codes; per-wallet variants of codes; limited attempts |
| Leaked claim ticket | a ticket names one wallet and expires in ≤ 1h, so it's useless to anyone else (already true in v3) |
| Follow → claim → unfollow | re-check at claim; for daily drops it's re-checked every day |
| Compromised app signer | onchain caps per drop (`maxAmountPerClaim`, per-period cap) bound the loss; KMS for the signer |
| API outage (X, Neynar, RPC) | the task shows "can't check right now, try again". It never auto-passes |

### Rollout order (cheapest and most useful first)
1. Onchain: hold, allowlist, buy / hold / volume / trade-through-app, LP / supply / stake, Basename, Coinbase Verified, wallet age.
   No paid APIs needed. RPC calls are batched and cached.
2. Farcaster (Neynar is already set up), quiz / secret / IRL code, daily check-in, streaks, referral.
3. Telegram, Discord, GitHub (free OAuth / bot), creator-reviewed submissions, X post-with-code (free oEmbed).
4. X follow / like / repost (paid API), YouTube, World ID / Human Passport, API-check (creator webhooks).

## 5. Architecture

```
            ┌───────────────────── Drops UI (create wizard, presets, My Drops, claim page) ──┐
            │                                                                                  │
   Task plugins (server, TypeScript)                     Gate modules (onchain, Solidity)
   lib/drops/tasks/<type>.ts                             contracts/drops/gates/*.sol
   { type, schema(zod), verify(ctx) → evidence }         IClaimGate.check(id, claimer, data) view
            │                                                                │
   Quest engine: progress in Redis, keyed by                                 │
   chainId:contract:id:wallet; issues EIP-712 ticket ───────► BaseDrops core escrow (immutable)
                                                              - funds, budget, caps, cooldowns
                                                              - link key + ticket check + nonces
                                                              - optional gate module call
                                                              - recovery: rotate / transfer / manager
```

### 5.1 `BaseDrops` core contract (new, immutable)
Per drop: `creator, pendingCreator, token, budget, amountPerClaim (or min/max), maxClaimsTotal,
maxClaimsPerWallet, cooldownSecs, periodSecs + maxClaimsPerPeriod, unlockAt, expiresAt,
linkSigner, ticketSigner, merkleRoot, gate, committed, paused, closed`.
Per wallet: `claims (uint32), lastClaimAt (uint64)` in one storage slot.

- `claim(id, ClaimArgs)`: link sig (wallet-bound, as in v3) → optional Merkle proof → optional
  gate `check` → optional EIP-712 ticket `{id, claimer, amount, nonce, deadline}` with a
  per-wallet nonce → caps / cooldown / period → pay. Constant gas at any size.
- Ticket amount is bounded by `maxAmountPerClaim`, so even a compromised app signer can't drain
  more than the drop's own rules allow.
- `topUp`, `pause`, `rotateLinkKey`, `setTicketSigner`, `transferCreator/acceptCreator`,
  `setManager`, `close` (refund; committed → only after expiry).
- `committed` drops can still be *loosened* (more budget, later expiry) but never tightened against claimers.
- Fee-on-transfer rejected, reentrancy guard, CEI, high-s signatures rejected (as in v3).
- Card codes (today's `BaseVoucher`) become a mode of the same contract: N link keys under one Merkle root,
  each usable once. One contract instead of two.

### 5.2 Task plugins (server)
Each task type is one file with a zod config schema and a `verify()` that returns evidence.
Adding a task type = adding one file and its form fields. No migration, no contract change.
Verification results are cached per wallet with a TTL, and every external call is rate-limited
(Neynar, RPC). Neynar needs a server API key in env; X stays behind a flag.

### 5.3 Data model (Redis)
- `drops:def:{chain}:{contract}:{id}`: task list + display config. The onchain creator signs it,
  so the server can't alter the rules.
- `drops:progress:{chain}:{contract}:{id}:{wallet}`: per-task status + evidence + timestamps.
- `drops:vault:{creator}`: encrypted secrets only (§3.2).

## 6. Delivery plan

| Phase | What ships | Contract deploy? |
|---|---|---|
| **1. Harden My Cards** | Fix §2.1 (SIWE + onchain hash check on POST); key records by `contract:id`; contract registry; batched multicall reads; clearer "this batch has no expiry" warning | no |
| **2. Encrypted vault + recovery phrase** | §3.2 for card secrets and link keys, plus migration of existing plaintext records (encrypt on the creator's next visit, then delete the plaintext) | no |
| **3. `BaseDrops` contract** | §5.1 + Foundry tests (fuzz caps/cooldowns, signature replay, reentrancy, recovery paths) + a Base Sepolia deploy script | Sepolia (you deploy mainnet) |
| **4. Quest engine + first task set** | hold token, allowlist, Basename, Coinbase Verified, onchain activity, quiz, Farcaster (needs Neynar key), referral | no |
| **5. Drops UI** | new section: presets, rule builder, task checklist on the claim page, My Drops with recovery tools, share images | no |
| **6. Extras** | streak bonus, random amounts, raffles, webhook tasks, X tasks | gate modules only |

Phases 1–2 fix today's real problems and are worth doing on their own. Phases 3–5 are the new
section. Each phase is its own PR with CI green.

## 7. Open decisions
1. Section name: **Drops** (proposed), or Quests / Rewards / Bounty Board.
2. Recovery phrase as the default for everyone (recommended), with wallet unlock only for EOAs.
3. Does the app's ticket signer stay a hot key in env, or move to a KMS? (Recommended: KMS before mainnet Drops.)
4. Farcaster tasks need a Neynar API key (paid tier for volume).
5. Mainnet deploy of `BaseDrops` is done by you, after a Sepolia run and ideally an external review.
6. Fee model, if any (e.g. 0.5% of drop budget) — not designed here.

## 8. To verify before Phase 4
- Exact EAS schema UIDs and indexer address for Coinbase Verifications on Base.
- Neynar endpoints and pricing for follow / reaction / channel-membership checks.
- Basename resolver address on Base mainnet.
- Current X API tiers and prices (and whether pay-per-use is available); confirm oEmbed still
  returns post text for public posts without auth.
- Explorer API (Etherscan v2 multichain) rate limits for per-wallet transfer history, versus
  reading logs over our own RPC.
- Telegram bot `getChatMember` needs the bot to be an admin in the group; Discord
  `guilds.members.read` scope approval.
