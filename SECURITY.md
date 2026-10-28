# Security Policy & Safeguards Architecture

Base Terminal (`Base Analytics App`) is a decentralized, non-custodial web3 terminal deployed on **Base Mainnet** (`Chain ID: 8453`). We prioritize the security of user funds, smart contracts, decentralized routing, and edge infrastructure.

---

## Supported Versions

Only the active mainnet deployment running on Base (`chain id 8453`) is supported for security updates and patch releases.

| Version | Status | Base Mainnet Deployment |
| :--- | :--- | :--- |
| **0.1.x (Mainnet)** | :white_check_mark: **Supported** | `https://base-analytics-app.vercel.app` |
| **< 0.1.0** | :x: Deprecated | Archived testnet releases |

---

## Reporting a Vulnerability

If you discover a security vulnerability, we appreciate your help in disclosing it responsibly. **Please do NOT file public GitHub issues, pull requests, or discuss vulnerabilities in public forums.**

### Contact Channels
- **GitHub Security Advisory**: Open a confidential advisory via [GitHub Security Advisories](https://github.com/Surya512002/Base-analytics-app/security/advisories/new).
- **Direct Security Email**: `security@base-analytics.app`

### Response Service Level Agreements (SLA)
- **Initial Acknowledgment**: Within **24 hours**.
- **Severity Assessment & Triage**: Within **72 hours**.
- **Patch Mitigation / Deployment**: Priority-based (Critical: **< 24 hours**; High: **< 72 hours**).

### Responsible Disclosure Guidelines
1. Provide comprehensive steps to reproduce the vulnerability, including minimal proof-of-concept scripts, transaction simulations (via Anvil or Foundry), or network request logs.
2. Do not attempt to exploit vulnerabilities against live mainnet contracts, real users, or platform treasury funds.
3. Allow reasonable time for remediation and testing before publishing any details.
4. Keep vulnerability discussions strictly confidential until an official patch has been deployed and announced.

---

## Assessment Scope

### In Scope
- **Smart Contracts (Base Mainnet)**:
  - `BaseVoucher` ([`contracts/BaseVoucher.sol`](contracts/BaseVoucher.sol)): Multi-asset gift card deposit custody, batch secret hashing, split validation, and claim settlement.
  - `BadgeMarketplace` ([`contracts/BadgeMarketplace.sol`](contracts/BadgeMarketplace.sol)): ERC-1155 escrow, listing mechanics, purchase settlements, and cancellations.
  - `XpStake` ([`contracts/XpStake.sol`](contracts/XpStake.sol)): Timelock escrow, referral tier calculations, and unlocking logic.
- **Edge Middleware & Geolocation**:
  - [`middleware.ts`](middleware.ts): Edge header inspection (`x-vercel-ip-country`), spoofing prevention, zero trust for client-provided country parameters, and compliance header injection.
- **Compliance Safeguards & Feature Controls**:
  - [`src/config/compliance.ts`](src/config/compliance.ts): Central feature flags (`stocks.swap`, `stocks.lend`, `stocks.launchPairs`, `stocks.vouchers`), fail-safe fallback logic, and remote kill switch integrations.
  - Exit-Only Invariant Enforcement: Ensuring withdrawals, repayments, unstaking, and voucher redemption remain accessible at all times.
- **Frontend & API Routes**:
  - API routes: `/api/compliance/status`, `/api/launchpad/quote`, `/api/voucher/prepare-create`, `/api/voucher/prepare-redeem`, `/api/mcp`.
  - Client state guardrails: `StockRiskModal`, `useCompliance`, exact ERC-20 approvals, and transaction simulation handlers.

### Out of Scope
- External DeFi protocols and third-party contracts (Uniswap v2/v3, Aerodrome, Slipstream, Morpho Blue, Aave v3, Moonwell, Circle USDC, Chainlink Oracles) — please report directly to the respective protocol security teams.
- Denial of Service (DoS) attacks targeting third-party public RPC providers or general infrastructure throttling.
- Social engineering, phishing, or client-side compromise of user machines / browser extensions.

---

## Core Security Invariants & Principles

### 1. The Exit-Only Invariant (Never Block User Funds)
Application-level compliance guardrails, region restrictions, or administrative kill switches **MUST NEVER** prevent users from accessing or withdrawing their own funds.
- **Allowed Exits**: Users in restricted regions or under safety pauses can always:
  - Withdraw collateral from lending markets.
  - Repay open debt balances.
  - Unstake locked assets upon maturity.
  - Sell existing tokenized stock holdings into USDC or ETH.
  - Claim and redeem valid crypto gift vouchers.
- **Gated Entries**: Only new entries (new deposits, new borrows, buying stocks, creating stock vouchers, and stock-paired token launches) are restricted.

### 2. Zero Private Key Custody & Non-Custodial Architecture
- The application never requests, handles, transmits, or stores user private keys, seed phrases, or raw credentials.
- All on-chain transactions are signed strictly on the client side via user-controlled wallets (Coinbase Wallet, MetaMask, Rainbow, Farcaster Frame wallets) conforming to EIP-1193.
- Contract architecture is immutable and ownerless: core contracts contain zero admin backdoor withdrawal functions.

### 3. Ephemeral Edge Processing & Zero PII Storage
- Geolocation checks operate exclusively at the edge network layer via Vercel edge headers (`x-vercel-ip-country`).
- Visitor IP addresses and geographic locations are never persisted to databases, server logs, or third-party trackers.
- Risk acknowledgements are stored exclusively in the user's browser `localStorage` under a versioned key (`base_stock_ack_v1.0`).

### 4. Strict Address Registry & EIP-55 Checksumming
- All contract, token, router, oracle, and treasury addresses are centralized in [`lib/contracts/registry.ts`](lib/contracts/registry.ts).
- Every address is verified against official protocol documentation and Basescan bytecode.
- Automated CI tests ([`lib/address-checksums.test.ts`](lib/address-checksums.test.ts)) reject any pull request containing unchecksummed or lowercase addresses.

### 5. Pre-Execution Transaction Simulation
- To protect users from wasted gas fees and failed transactions, all contract interactions are simulated via `eth_call` / Viem simulation (`simulateCallsBeforeExecution`) prior to requesting a wallet signature.

### 6. Exact Token Approvals
- The terminal avoids infinite approval patterns (`type(uint256).max`) by default.
- ERC-20 allowances request strictly the exact amount required for the specific transaction, minimizing risk if a third-party contract is ever compromised.

### 7. Safe BigInt Arithmetic & No Floating-Point Currency
- All token amounts, fees, balances, and health factor calculations use native `BigInt` or fixed-point decimal arithmetic.
- JavaScript floating-point arithmetic is strictly prohibited for monetary or balance accounting.

---

## Automated Security Toolchain & Pre-Commit Gates

The codebase enforces rigorous static analysis, secrets detection, and testing suites prior to any mainnet deployment:

```bash
# 1. Full Pre-Flight Verification Gate
npm run verify                  # typecheck + lint + audit + secrets:scan + test + test:fork

# 2. Automated Secrets & Hygiene Scanner
npm run secrets:scan            # Scans working directory and git commit history for credentials
npm run secrets:gitleaks        # Containerized Gitleaks detection

# 3. Dependency Vulnerability Audits
npm run audit                   # npm audit --omit=dev (production dependency scan)

# 4. Smart Contract Security & Static Analysis
forge test -vvv                 # Foundry invariant and fuzz tests
forge coverage                  # Test coverage report
slither .                       # Slither static vulnerability analysis

# 5. On-Chain Mainnet Fork Tests
npm run test:fork               # Fork tests against live Base mainnet contracts & RPC
```

---

## Technical Limitations & Gating Disclosures

- **Client-Side VPNs / Proxies**: IP-based geolocation headers can be bypassed via VPNs, proxies, or Tor. Geo-gating represents one technical layer of product safeguards and does not constitute guaranteed geographic exclusion.
- **Oracle Staleness Outside Market Hours**: Tokenized stocks (B20 precompiles) trade 24/7 in Base AMM pools, but underlying Chainlink equity price feeds operate on a 24/5 schedule. Users are notified of potential price staleness outside traditional US market hours.
