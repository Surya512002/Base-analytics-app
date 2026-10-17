# Security Policy

## Supported Versions

Only the latest release running on Base Mainnet (`chain id 8453`) is supported for security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x (Mainnet) | :white_check_mark: |
| < 0.1.0 | :x:                |

---

## Reporting a Vulnerability

We take the security of Base Analytics App, smart contracts, user funds, and private data seriously. If you discover a vulnerability, please do NOT file a public issue or discuss it in public channels.

### Contact Information
- **Email**: `security@base-analytics.app` (or contact via GitHub Security Advisories)
- **Response SLA**:
  - Initial acknowledgment: Within **24 hours**.
  - Assessment and severity triage: Within **72 hours**.
  - Patch deployment / mitigation: Priority based on severity (Critical: <24h).

### Guidelines for Responsible Disclosure
1. Provide detailed steps to reproduce the issue, including proof-of-concept scripts or transaction simulations (e.g. using Foundry or Anvil fork).
2. Do not attempt to exploit vulnerabilities against real users, live mainnet contracts, or treasury funds.
3. Allow reasonable time for remediation before any public disclosure.

---

## Scope

### In Scope
- **Smart Contracts** on Base mainnet:
  - `BaseVoucher` (`contracts/BaseVoucher.sol`): Card creation, batch redemption, secret hashing, ETH/USDC custody.
  - `BadgeMarketplace` (`contracts/BadgeMarketplace.sol`): ERC-1155 escrow, listing, buying, and cancellation.
  - `XpStake` (`contracts/XpStake.sol`): Timelock escrow, referral tier boost calculations.
- **Frontend & API Routes**:
  - Slippage calculation, exact approval enforcement, simulation checks.
  - API routes (`/api/launchpad/*`, `/api/voucher/*`, `/api/cron/*`).
  - Access controls, SIWE authentication, and replay protection.

### Out of Scope
- Third-party protocols (Morpho, Aave, Moonwell, Aerodrome, Superform, Uniswap, Chainlink) — report directly to respective protocol security teams.
- Denial of Service (DoS) attacks requiring massive RPC spam or infrastructure throttling.
- Social engineering or physical security attacks.

---

## Security Architecture Highlights
- **Zero Private Keys Stored**: The frontend NEVER handles, requests, or stores user private keys or seed phrases.
- **Strict Address Registry**: All protocol, token, router, and fee recipient addresses are centralized in [`lib/contracts/registry.ts`](file:///d:/Base-analytics-app/lib/contracts/registry.ts) and validated against official verified contracts on Basescan.
- **Transaction Simulation**: Transactions are simulated (`simulateContract` or `eth_call`) before prompting user wallets.
- **Exact Token Approvals**: Spender approvals default strictly to the exact transaction amount required.
- **Strict BigInt Math**: All monetary, token, fee, and health calculations use native `BigInt` or exact decimals; floating-point math is never used for token balance or transfer amounts.
