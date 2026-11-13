# Shared-link vouchers ("one link, first N claim")

Contract: `contracts/BaseVoucherCampaign.sol` · UI: `components/voucher/VoucherCampaignPanel.tsx` ("One link" tab) ·
Short link page: `app/claim/[id]` · API: `app/api/voucher/campaign/*`

## What it does
A creator funds **one** campaign (ETH, USDC, or a tokenized stock) with 1–1000 slots and shares **one link**.
The first N distinct wallets to claim each receive `total / N`. Replaces generating and sharing N separate card links
(the legacy `BaseVoucher` flow is untouched and still works).

## Sender identification (Base's "identify the sender" rule)
- The contract records `msg.sender` as `creator`; the claim page shows that address + Basescan link — it cannot be spoofed.
- The page reverse-resolves the creator's **Basename** and shows "Verified Basename" only when it matches.
- A typed sender name that is not the wallet's own Basename is shown as **unverified** with a warning.
- The claim landing page (`/claim/:id`) shows all of this *before* a wallet is connected.

## Safety model
| Risk | Mitigation |
|---|---|
| Link key leaks to servers/CDN/referrers | Generated in the creator's browser; lives only in the URL fragment; only its *address* is onchain |
| Claims published onchain get reused (v1 flaw) | **v2:** a claim carries a link-key signature over (chain, contract, campaign, claimer). It only works for the wallet it was made for, so watching the chain reveals nothing reusable. Link proofs and tickets use separate domain tags |
| One wallet drains the pool | `hasClaimed[campaign][wallet]` enforced onchain; creator can't self-claim |
| Bots cycling wallets from one machine | Optional **verified claims**: claim also needs a 10-min ticket bound to (chain, contract, campaign, claimer, deadline). The ticket API requires a valid link proof for that wallet first, and rate-limits only the requester IP and the campaign — never a wallet address the caller merely names |
| Tokenized stocks in restricted regions | Stocks force verified claims; ticket route applies the existing kill switch + region rules (entry blocked in exit-only/blocked regions) |
| Creator rug-pull after promising a gift | **Committed** mode: creator cannot close before expiry (enforced onchain, shown to claimers) |
| Funds stuck forever | Creator can always `close()` (after expiry if committed); refund is exactly the unclaimed shares |
| Reentrancy / odd tokens | CEI + reentrancy guard; fee-on-transfer tokens rejected; non-standard `transfer` return handled; high-`s` signatures rejected |
| Unlimited approvals | UI approves exactly the campaign total |
| Doomed claims waste gas | UI simulates the claim first and shows a readable reason |

## Known limits (be honest with users)
- **A public link is a bearer instrument.** Without verified claims, anyone with the link — including sybil bots using many
  wallets — can take slots. Verified claims reduce but do not eliminate this; they are not identity/KYC.
- If a creator loses the link *and* clears browser storage, the link key is unrecoverable (funds can still be refunded via close()).
- **v1 is retired.** v1 (`0xf764dcce3ddd898fc6e7bc642ae61789e2541e0c`) sent a plaintext shared secret in `claim()` calldata, so
  after the first claim observers could take remaining slots (Vercel Security Review base-analytics-app/1). The app no longer
  creates campaigns on it; its two campaigns were already fully claimed / refunded.
- Region checks use CDN geo headers — a product safeguard, not legal compliance.

## Deploy
1. Deploy to Base Sepolia: `forge script script/DeployBaseVoucherCampaign.s.sol --rpc-url base_sepolia --broadcast --verify`.
2. Create a campaign, claim with 3 wallets, confirm the 4th-after-N reverts, test `close()`.
3. Set `NEXT_PUBLIC_CAMPAIGN_CONTRACT`, and `CAMPAIGN_CLAIM_SIGNER_KEY` (**dedicated zero-balance wallet**).
4. Get an independent audit before enabling stock campaigns on mainnet.

## Tests
- `npx vitest run lib/voucher/campaign.test.ts` — link/secret/ticket/validation/identity logic.
- `test/campaign-evm/` — 44 checks against the compiled contract (incl. the replay attack) in an in-process EVM (see its README).
