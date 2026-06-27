---
title: "Base Voucher Plugin"
description: "Create and redeem ETH/USDC crypto gift cards on Base via Base Analytics HTTP API → send_calls."
tags: [agent-commerce, payment-cards, gift-cards, crypto-gift-cards]
name: base-voucher
version: 0.1.0
integration: http-api
chains: [base]
requires:
  shell: none
  allowlist: [base-analytics-app.vercel.app]
  externalMcp: null
  cliPackage: null
auth: none
risk: [pii, irreversible]
---

# Base Voucher Plugin

> [!IMPORTANT]
> Complete the Base MCP onboarding flow in `SKILL.md` before calling any Base Voucher endpoint:
> 1. Call `get_wallets` (Detection)
> 2. Present wallet status and disclaimer (Onboarding)
>
> The user's wallet address — required for USDC allowance optimization and redeem — is only confirmed during Detection. **Card secrets are shown once at create time and cannot be recovered from chain or the app if lost.**

## Overview

Base Voucher is a decentralized crypto gift card protocol on Base mainnet (ETH and USDC only). Users deposit a total amount, split it evenly into 1–50 cards, and share each card's **Card ID** + **Secret** with recipients who redeem onchain.

This plugin reads batch metadata and prepares unsigned calldata from the Base Analytics HTTP API, then executes via Base MCP `send_calls`. No separate MCP server or CLI required.

**App:** https://base-analytics-app.vercel.app  
**Supported chain:** Base mainnet (`8453` / Base MCP chain string `base`).

## Surface Routing

Base Voucher is HTTP-only; follow [../references/custom-plugins.md](../references/custom-plugins.md) for HTTP routing.

| Capability | Path |
|-----------|------|
| Read batch metadata (no secrets) | Harness HTTP tool if available, else `web_request` GET against `base-analytics-app.vercel.app`. |
| Prepare create batch (returns secrets + calls) | Harness HTTP tool or `web_request` GET → `send_calls`. |
| Prepare redeem | Harness HTTP tool or `web_request` GET → confirm preview → `send_calls`. |

**Shell-less / chat-only surfaces (Claude.ai, ChatGPT):** `base-analytics-app.vercel.app` must be on the Base MCP `web_request` allowlist. Until allowlisted, construct the GET URL with all query params and ask the user to paste the JSON response into chat, then continue with `send_calls`. Do not invent calldata or secrets.

**Coding harnesses (Cursor, Claude Code, Codex):** use the harness HTTP tool (`fetch` / `curl`) first — any GET, no allowlist needed.

## Endpoints

Base URL: `https://base-analytics-app.vercel.app`

### Read endpoints (use web_request GET or harness HTTP)

```
GET https://base-analytics-app.vercel.app/api/vouchers?batchId=<batchId>
GET https://base-analytics-app.vercel.app/api/vouchers?creator=<0x-address>
```

Returns public batch metadata only — **no card secrets**. Fields include `batchId`, `creator`, `asset`, `totalAmount`, `amountPerCard`, `cardCount`, `message`, `redeemedCount`.

### Prepare endpoints (use web_request GET or harness HTTP → send_calls)

#### Create gift card batch

```
GET https://base-analytics-app.vercel.app/api/voucher/prepare-create?asset=USDC&total=10&cards=5&message=Happy+Birthday&creator=<0x-address>
```

| Param | Required | Notes |
|-------|----------|-------|
| `asset` | no (default `USDC`) | `USDC` or `ETH` |
| `total` | yes | Human decimal string — `10` = $10 USDC or 10 ETH units |
| `cards` | yes | Integer 1–50; total must divide evenly per card |
| `message` | no | Optional note on cards (max 280 chars onchain) |
| `creator` | recommended | User wallet from `get_wallets`; omits USDC `approve` call when allowance is sufficient |

**Success response shape:**

```json
{
  "valid": true,
  "protocol": "Base Voucher",
  "chain": "base",
  "contract": "0x...",
  "expectedBatchId": 42,
  "asset": "USDC",
  "total": "10",
  "cardCount": 5,
  "perCardFormatted": "$2.00 USDC",
  "calls": [
    { "to": "0x...", "data": "0x...", "value": "0x0" }
  ],
  "cards": [
    {
      "cardId": "42-0",
      "cardIndex": 0,
      "secret": "ABCDE-FGHIJ-KLMNO-PQRST",
      "shareText": "🎁 Base Voucher — Crypto Gift Card\n..."
    }
  ]
}
```

When `valid: false`, read `error` and ask the user to adjust `total` or `cards`. Do not call `send_calls`.

For USDC, `calls` may contain **two** ordered steps: `approve` (USDC) then `createUsdcBatch`. For ETH, `calls` contains one payable step; use each item's `value` field (may be non-zero for ETH).

#### Redeem gift card

```
GET https://base-analytics-app.vercel.app/api/voucher/prepare-redeem?cardId=12-3&secret=ABCDE-FGHIJ-KLMNO-PQRST
```

| Param | Required | Notes |
|-------|----------|-------|
| `cardId` | yes | Format `batchId-cardIndex` (e.g. `12-3`) |
| `secret` | yes | UniVoucher-style code `XXXXX-XXXXX-XXXXX-XXXXX` (case-insensitive) |

**Success response shape:**

```json
{
  "valid": true,
  "cardId": "12-3",
  "batchId": 12,
  "cardIndex": 3,
  "calls": [{ "to": "0x...", "data": "0x...", "value": "0x0" }],
  "preview": {
    "asset": "USDC",
    "amountFormatted": "$2.00 USDC",
    "message": "Happy Birthday",
    "alreadyRedeemed": false
  }
}
```

If `preview.alreadyRedeemed` is `true` or `valid` is `false`, stop — do not call `send_calls`.

## Orchestration

### Create and share cards

```
1. get_wallets → address
2. GET /api/voucher/prepare-create?asset=...&total=...&cards=...&message=...&creator=<address>
   (harness HTTP tool, or web_request if allowlisted, or user-paste fallback)
3. If valid: false → show error, stop
4. send_calls(chain="base", calls from response.calls[])
5. User approves at approvalUrl → get_request_status(requestId) until confirmed
6. Print every item in response.cards[]: cardId, secret, shareText
7. Warn: secrets cannot be recovered if lost
```

### Redeem a card

```
1. get_wallets → address (redeemer)
2. GET /api/voucher/prepare-redeem?cardId=...&secret=...
3. Show preview.amountFormatted and preview.message; confirm with user
4. If preview.alreadyRedeemed → stop
5. send_calls(chain="base", calls from response.calls[])
6. User approves → get_request_status(requestId)
7. Confirm: amount sent to user's Base Account
```

### Lookup batch (read-only)

```
1. GET /api/vouchers?batchId=<n> → show cardCount, redeemedCount, amounts (no secrets)
```

## Submission

Target tool: **`send_calls`**.

Map every object in `response.calls[]` directly into the `calls` array:

```json
{
  "chain": "base",
  "calls": [
    { "to": "<call.to>", "value": "<call.value>", "data": "<call.data>" }
  ]
}
```

- `value` defaults to `0x0` when omitted in the mapping; ETH create batches may require a non-zero `value` on the final call — always pass through the API value unchanged.
- Execute all `calls` in order as **one** `send_calls` batch so the user approves once (USDC approve + create is atomic).
- After broadcast, poll `get_request_status(requestId)` per [../references/approval-mode.md](../references/approval-mode.md).

## Example Prompts

### Create 5 USDC gift cards with $10 total

```
1. get_wallets → address
2. GET /api/voucher/prepare-create?asset=USDC&total=10&cards=5&creator=<address>
3. send_calls(chain="base", calls from response.calls)
4. User approves → get_request_status
5. Return all cardId + secret + shareText pairs to the user
```

### Split 0.01 ETH into 3 cards with a message

```
1. get_wallets → address
2. GET /api/voucher/prepare-create?asset=ETH&total=0.01&cards=3&message=GM+from+Base&creator=<address>
3. send_calls(chain="base", calls from response.calls) — preserve ETH value field
4. User approves → get_request_status
5. Share cards with user
```

### Redeem card 12-3

```
1. get_wallets → address
2. GET /api/voucher/prepare-redeem?cardId=12-3&secret=<user-provided-secret>
3. Confirm preview.amountFormatted with user
4. send_calls(chain="base", calls from response.calls)
5. User approves → get_request_status
```

### Check batch status

```
1. GET /api/vouchers?batchId=12
2. Report redeemedCount / cardCount and per-card amount (no secrets)
```

## Risks & Warnings

- **PII / secrets.** Create responses include irreversible gift-card secrets. Display them only to the creator, warn that loss is permanent, and do not store secrets in long-term memory without explicit user consent.
- **Irreversible onchain writes.** Create and redeem move real ETH/USDC. Always run Base MCP onboarding, show the approval link, and wait for user confirmation before `send_calls`.
- **One redeem per wallet per batch.** Onchain rule: each wallet may redeem at most one card per batch. If redeem fails with a wallet-limit error, explain this constraint.
- **Even split requirement.** Total deposit must divide evenly across card count (USDC 6 decimals, ETH 18 decimals). The prepare endpoint returns `valid: false` when split is impossible — adjust amounts rather than forcing the transaction.

## Notes

- **Card ID format:** `{batchId}-{cardIndex}` — zero-based index (batch with 5 cards uses `N-0` … `N-4`).
- **Secret format:** `XXXXX-XXXXX-XXXXX-XXXXX` (uppercase alphanumeric, no ambiguous chars).
- **Max cards:** 50 per batch.
- **Assets:** ETH (native) and USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) only.
- **expectedBatchId:** predicted from `nextBatchId` at prepare time; verify onchain after create if batch ID matters for support.
- **Web UI:** https://base-analytics-app.vercel.app — manual create/redeem fallback when HTTP is unavailable.
- **Allowlist request:** submitters should ask Base maintainers to add `base-analytics-app.vercel.app` to the MCP `web_request` allowlist when opening the `base/skills` PR.
