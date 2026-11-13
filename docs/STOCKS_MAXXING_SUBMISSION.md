# Stocks Maxxing submission kit

Quest window: Nov 5 – Dec 5, 2026. To enter you need **(1)** a public X post with a video demo that tags
@buildonbase and **(2)** the official Submission Form (with the X post link + tracks). The form is required — the
post alone does not count. Only you can do those two steps (your account, your identity).

## Which tracks to enter

| Track | Idea it answers | What we have | Strength |
|---|---|---|---|
| 1 · Meme & Community Economies | **1.4 Giftable stock collectibles** | "One link" campaigns: stock/USDC/ETH gift, message, unlock date, expiry, refund, eligibility check before claim, verified sender | **Strongest — enter this** |
| 3 · Programmable Stock Markets | **3.3 Stock-backed loans** | Loan planner: conservative limit, liquidation price, gap stress (−10/−20/−35/−50% + custom), repay options, pause/stale-price warnings | Medium — no live stock borrow market is listed right now, so the demo is a planner, not deposit→borrow→repay |

One prize per project, but you may enter more than one track. Lead with Track 1.

## What was built during the Quest (say this on the form — pre-existing code is allowed if disclosed)
Built Nov 12, 2026 on top of the existing Base Analytics app:
- `BaseVoucherCampaign` v2 contract — one shared link, first N wallets claim, one claim per wallet, wallet-bound link
  proofs (nothing reusable is published onchain), optional verified-claim tickets, committed mode, unlock date, expiry,
  creator refund. Verified on Basescan, Base mainnet: `0x477919fc62b28ae4947724f7b67219d4a533a449`.
  (v1 `0xf764dcce3ddd898fc6e7bc642ae61789e2541e0c` is retired after a security review found its claim secret could be
  reused from public calldata; it was fixed and migrated within a day.)
- Sender identification: onchain creator address + Basename check; typed names that don't match are flagged.
- Verified-claim ticket API (rate limits, kill switch, region rules for tokenized stocks).
- `/claim/:id` landing page that shows sender + slots before any wallet connects.
- Stock-backed loan planner with gap stress scenarios.
Pre-existing (not Quest work): the legacy BaseVoucher card flow, swap, launchpad, lending discovery.

## Onchain evidence (Base mainnet)
**v2 (current)** — `0x477919fc62b28ae4947724f7b67219d4a533a449`
- Deploy: `0x78c7e9dd6958f988733506a96b05d057da5e653871e03cc8cd1342cdc998b440`
- Gift #1 (verified claims) created: `0x67813ad159e8c8d67cf2f40be9f4c3388a44fdb5c7e4e7ddfd7bd9c7877b5279`
- Ticket without a link proof → refused (400); ticket using someone else's proof → refused (403)
- Claim with the claimer's own proof: `0xd56768181a2e22346023b2a9f48cae20ce7c3f52f3b517968d5fe26166a19f32`
- Another wallet replaying that published claim → reverts "Invalid link"
- Sender closes, unclaimed share refunded exactly: `0x9bdaaabccbc92ac80057fc43447c52cbd912d583d55f585a89b4b59e15f1d355`

**v1 (retired)** — `0xf764dcce3ddd898fc6e7bc642ae61789e2541e0c`
- Contract deploy: `0xb4ab73d14dc9db84c78082baca4f4c3c3c520f71e41d63185b228ff9a71c0626`
- Campaign #1 (verified claims, 2 slots) created: `0xf159c5c2a0bd1054bd0de6c2cc2bcabd23b6144e098cce9e2a029261ebc7b791`
- Claim 1: `0x6e1c8c0732b94dc2d3ec8e97d0498eda08280e01b3fe5955e906dfe8c6e62842`
- Claim 2: `0xf6d771d565c3500ce6d9f469fe2577b1ccbb2aa00fcf2ce349bd4a8a0e4d949f`
- 3rd wallet: ticket refused — "Campaign is full"; claim without ticket reverts "Ticket expired".
- Expired-gift refund: see gift #2 above.

## Track 1.4 brief → where it is in the app
| Brief asks for | Where | Proof |
|---|---|---|
| Package a stock position as a gift, with a message | Vouchers → One link → pick a tokenized stock, 1 · single gift (or N slots), message | create form |
| Optional unlock date | “Opens (unlock date)”: right away / 1h / tomorrow / 7 days; enforced onchain (`Not unlocked yet`) | contract + EVM tests |
| Check the recipient's eligibility **before** they claim | “Can you claim?” checklist (gift open, not sender, not already claimed, kill switch, stock gifts enabled, region, sanctions screen). Claim button stays disabled when not eligible; the ticket server enforces the same checks | `/api/voucher/campaign/:id/eligibility`, 5 unit tests incl. restricted region |
| Make clear who owns the assets before acceptance | “Ownership, expiry & refunds” box on the claim page and in-app: escrow in the contract until the claim confirms | claim page |
| When unclaimed gifts expire | Same box + expiry chip; expiry enforced onchain | claim page |
| How senders get refunds if a recipient can't legally receive | Ineligible claims are refused before anything moves; the share stays in escrow; sender refunds from “My links”, which lists every campaign the wallet funded from chain (any device) | live demo below |
| Identify the sender | Name (Basename verified, or typed name flagged unverified) **and** the full creator wallet address from the contract, with copy + Basescan | claim page |

## Live mainnet demo: expired gift refunds cleanly (gift #2)
1. Committed 1-slot gift, 0.000001 ETH, 75 s expiry — tx `0x2d9fbf6ac82f936be605b2b4c21adcfc4d0e3744f1e98410149df49d54fd40f5`
2. Sender tries to pull it back before expiry → reverted (committed)
3. Recipient claims after expiry → reverted; eligibility API: “This gift has expired; unclaimed funds go back to the sender.”
4. Sender closes → `CampaignClosed` refunded exactly 0.000001 ETH — tx `0x5320cf326fbdb7093f8057dec6d09cee3181644796df9ed35065afe117c97301`
5. Onchain: closed = true, claims remaining = 0. Any later claim reverts “Campaign closed”.

For the **ineligible** shot in your video: gift a tiny amount of a tokenized stock you own, open the link from a
restricted region (e.g. US via VPN) → “Not eligible — nothing will be sent”, then refund from My links.

## Demo video script (≈2 min, Loom)
1. **Hook (10s):** "Sending a stock gift to 50 people used to mean 50 links. Now it's one."
2. **Create (30s):** Vouchers → One link. Pick a tokenized stock or USDC, 50 slots, message, opens tomorrow,
   expires in 7 days, verified claims on. Show the per-claim preview and the safety checkbox. Fund.
3. **Share (10s):** Copy the one link. Point out the secret lives in the `#` fragment — never hits a server.
4. **Claim (30s):** Open the link in another wallet. Show "Sent by" with Basename badge + Basescan link, slots left,
   committed badge. Claim. Show the slot counter move.
5. **Rules hold (20s):** Same wallet tries again → refused. Slots run out → "All claims taken".
   Restricted region / stock kill switch → ticket refused, funds stay safe.
6. **Refund (10s):** My links → expired campaign → "Refund remaining" returns unclaimed shares.
7. **Bonus (10s):** Lend → NVDAc → loan planner gap table.
8. **Close (5s):** contract address on Basescan.

Tip: for the refund shot, make a campaign with a short expiry from a script (the UI's shortest is 24h).

## X post draft (edit freely)
> Built for #StocksMaxxing @buildonbase 🎁
> One link → first N wallets claim a tokenized-stock (or USDC) gift.
> ✅ sender verified onchain + Basename
> ✅ one claim per wallet, region & bot checks
> ✅ unlock date, expiry, refunds
> Live on Base: <link> · Demo 👇

## Before you post — checklist
- [ ] Push code and confirm the live site serves `/api/voucher/campaign/config`
- [ ] Basescan shows verified source for the contract
- [ ] Record the demo on the **live** site with two of your own wallets and tiny amounts
- [ ] Don't claim the app is "compliant" or that tokens give shareholder rights (the rules forbid that)
- [ ] Submit the form with the X post link and the tracks
