# Drops on Base Sepolia — live test results

**Run:** 2026-11-19 with `test/live/drops-sepolia.live.test.ts` (`npm run test:live`, env vars in the file header).
**Result: 8/8 scenarios passed, 35 steps.** The app's own code (prepareDrop, link / code / allowlist signing, the server's task
checks, tickets and raffle) ran against the real deployed contract. Expected refusals were checked with `eth_call` simulation
and matched the exact contract reason.

## Contracts (Base Sepolia, chain 84532, source verified)
| Contract | Address |
|---|---|
| BaseDrops | [0x057e220EDe8150C7c143684a3a4171ed6f212eAF](https://sepolia.basescan.org/address/0x057e220EDe8150C7c143684a3a4171ed6f212eAF#code) |
| TokenBalanceGate | [0x06E5853704DC4B3d3F9172eC545e0130b18B2B67](https://sepolia.basescan.org/address/0x06E5853704DC4B3d3F9172eC545e0130b18B2B67#code) |

Deployed at block 60718098 from a testnet-only deployer (`0x0961…4B33`). Claimers: c1 `0x6912…3097`, c2 `0x8d49…a4c5`.
Every transaction below is listed in full on the [BaseDrops transaction history](https://sepolia.basescan.org/address/0x057e220EDe8150C7c143684a3a4171ed6f212eAF).
(Hashes are shortened here because the repo's secret scanner treats any 32-byte hex as a possible key.)

## Steps
| Step | Result | Tx |
|---|---|---|
| link: create drop 2000000001 | ok | `0xfa5be1f3…a1e2f3` |
| link: c1 claims | paid | `0x5bb4359f…9ca064` |
| link: c1 again / c2 with c1's proof | refused (limit / invalid link) | simulated (no gas) |
| link: app reads drop + wallet status | 1 claimed; c1 blocked; c2 allowed | simulated (no gas) |
| cards: create drop 2000000002 | ok | `0xf43c01ab…3599a3` |
| cards: c1 redeems code 1 | paid | `0x2da83e73…3d1d37` |
| cards: reuse code 1 / c2 with c1-signed code 2 | refused | simulated (no gas) |
| cards: c2 redeems code 2 | paid | `0x751556c4…930d42` |
| allowlist: create drop 2000000003 | ok | `0x0b22113b…0b59dc` |
| allowlist: c1 claims | paid | `0x2327529a…006df7` |
| allowlist: c2 | refused (not on allowlist) | simulated (no gas) |
| gate: create drop 2000000004 | ok | `0x3802e9ef…b88515` |
| gate: c1 holds no USDC | refused (gate check failed) | simulated (no gas) |
| gate: creator closes | refunded | `0x8579e98a…7bd42d` |
| cooldown: create drop 2000000005 | ok | `0x70fb0b7b…82f314` |
| cooldown: c1 claim #1 | paid | `0x3bbf6603…0ce79d` |
| cooldown: immediate re-claim | refused (cooldown active) | simulated (no gas) |
| cooldown: c1 claim #2 after 45s | paid | `0x91980a7f…e81f36` |
| tasks: create drop 2000000006 | ok | `0x8f7f098b…691568` |
| tasks: c1 claims with app ticket (13392111141684 wei) | paid | `0xcdf7755c…e91e96` |
| tasks: replay / c2 with c1's ticket / c2 without tasks | refused | simulated (no gas) |
| raffle: create drop 2000000007 | ok | `0xdf0d55ca…56dd5d` |
| raffle: drawn on block 60782920 | winner 0x8d4945… | simulated (no gas) |
| raffle: winner claims | paid | `0xa3015f9f…c6da0d` |
| recovery: create drop 2000000008 | ok | `0xccb3d13c…0c18e4` |
| recovery: rotate link key | ok | `0x0710d559…a12a6d` |
| recovery: old link | refused (invalid link) | simulated (no gas) |
| recovery: pause | ok | `0xb6cd23bd…034abf` |
| recovery: resume | ok | `0xafc1c468…a6fff4` |
| recovery: c1 claims with the new link | paid | `0x3571291f…73ce5d` |
| recovery: start move to c2 | ok | `0xa2908d9d…668082` |
| recovery: c2 accepts | ok | `0x1576d27f…2477d2` |
| recovery: c2 closes | refund to c2 | `0x1d9822d6…e765c3` |
| locked: create drop 2000000009 | ok | `0x3428d71b…b61fd6` |
| locked: close / pause before expiry | refused | simulated (no gas) |

## What this covers
- **Link drops:** claim once; the link proof is bound to the wallet (copying it to another wallet fails); the app reads the drop and each wallet's status correctly.
- **Gift cards:** each code works once; a code signed for one wallet can't be used by another; codes and proofs travel in the link fragment.
- **Allowlist:** a listed wallet claims with an app-built Merkle proof; others are refused.
- **Token-holder gate:** wallets without the token are refused; the creator closes and gets the refund.
- **Daily / cooldown:** a second claim inside the cooldown is refused, then succeeds after it.
- **Task drop:** the server checks a task, signs a ticket with a random ("lucky") amount, and the contract pays exactly that amount; replaying the ticket, using it from another wallet, or asking without the task are all refused.
- **Raffle:** two wallets enter, the draw uses a real Sepolia block, and only the winner gets a ticket and claims.
- **Recovery:** new link (the old one stops working), pause / resume, moving the drop to another wallet (only the new owner can close; the refund goes to them); locked drops can't be closed or paused before they end.

## Not covered here (try these in the app on a preview deployment)
- Real browser wallets (MetaMask, Coinbase Smart Wallet / Base App batch calls on Sepolia).
- USDC / ERC-20 drops (covered by the Foundry tests; the test wallets hold no Sepolia USDC).
- Task checks that call outside services (Farcaster, X, Discord, Telegram, explorer) and the linked-accounts sign-in flow.
