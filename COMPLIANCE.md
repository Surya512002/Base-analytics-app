# Tokenized Stocks Compliance Guardrails & Product Safeguards

> **IMPORTANT DISCLAIMER**  
> The controls, checks, and configuration documented below represent **technical product safeguards** implemented as a risk-mitigation layer pending formal review by qualified legal counsel.  
> **This document, the software code, and any user-facing statements DO NOT constitute legal, financial, or tax advice, and this software application must NEVER claim to be legally "compliant" or government-endorsed.**

---

## 1. Architecture Overview

Compliance guardrails are enforced across a defense-in-depth model:
1. **Server-Side Edge Middleware (`middleware.ts`)**: Evaluates the visitor's country of origin via Vercel edge headers (`x-vercel-ip-country`) and attaches sanitized compliance headers (`x-user-country`, `x-compliance-mode`).
2. **Server-Side API Route Enforcement (`/api/launchpad/quote`, `/api/stocks`)**: Validates country and region mode on every stock quote or action request. Incoming `direction === "buy"` transactions targeting stock tokens are rejected with HTTP 403 or `{ error: "Tokenized stock features are not available in your region" }`.
3. **Exit-Only Mode (Crucial Fund Access Protection)**: Users in restricted regions or under maintenance flags are **never** blocked from accessing their own assets. Selling stock tokens back to USDC/ETH, repaying borrow positions, withdrawing collateral, and redeeming existing gift vouchers remain 100% functional.
4. **First-Use Risk Acknowledgement Modal (`StockRiskModal`)**: Presents a concise summary of equity volatility, 24/5 equity market hours vs 24/7 AMM price staleness, and links to the issuer's terms of service before any stock interaction. Acceptance is recorded in `localStorage` under `STOCK_ACKNOWLEDGEMENT_VERSION`.
5. **No Client-Side Geo Spoofing**: Client-submitted geolocation is never trusted; all determinations derive from server-side network headers.

---

## 2. Configuration Settings (`src/config/compliance.ts`)

| Setting / Env Variable | Default Value | Description |
| :--- | :--- | :--- |
| `COMPLIANCE_GLOBAL_KILL_SWITCH` | `false` | Server-side kill switch that pauses all new stock features instantly across all regions. |
| `COMPLIANCE_REMOTE_CONFIG_URL` / `EDGE_CONFIG` | *(Empty)* | Vercel Edge Config connection string to toggle the kill switch dynamically without redeploying code. |
| `COMPLIANCE_FEATURE_STOCKS_SWAP` | `true` | Enables or disables the stock swap routing feature. |
| `COMPLIANCE_FEATURE_STOCKS_LEND` | `true` | Enables or disables stock lending and collateral borrowing. |
| `COMPLIANCE_FEATURE_STOCKS_LAUNCH` | `true` | Enables or disables token launches paired against stock tokens. |
| `COMPLIANCE_FEATURE_STOCKS_VOUCHERS`| `true` | Enables or disables creating new crypto gift vouchers backed by stock tokens. |
| `COMPLIANCE_RESTRICTED_REGIONS` | `US,CU,IR,KP,SY,RU,BY,MM,VE` | Comma-delimited list of ISO 3166-1 alpha-2 restricted country codes. |
| `COMPLIANCE_REGION_MODE` | `exit-only` | Action mode for restricted jurisdictions: `exit-only` (default), `blocked`, or `full`. |
| `COMPLIANCE_SANCTIONS_SCREENING_ENABLED` | `false` | Enables pluggable wallet sanctions screening before transaction preparation. |
| `COMPLIANCE_SANCTIONS_PROVIDER` | `chainalysis_oracle` | Selected sanctions screening provider (`chainalysis_oracle`, `trm_labs`, `elliptic`). |

---

## 3. Remote Kill Switch (Vercel Edge Config)

To pause stock features instantly without waiting for a Git commit or Vercel production rebuild:
1. Create a Vercel Edge Config store in your Vercel Dashboard.
2. Link the Edge Config store to the project or set the `EDGE_CONFIG` environment variable.
3. In Edge Config, set key `stock_features_kill_switch` to `true`.
4. Our application queries Edge Config with a 1.5-second timeout and immediately enters `exit-only` mode globally if active, with graceful fallback to local defaults if unreachable.

---

## 4. Honest Technical Limitations of Geo-Gating

It is essential to document honestly in both product specifications and legal documentation that:
- **IP-based geolocation is an imperfect technical perimeter**: Commercial VPNs, Tor exit nodes, and proxy servers can mask a visitor's true physical location.
- **Geo-gating serves as a product access safeguard**, not an impenetrable identity or nationality verification barrier.
- For institutional or regulated offerings, formal Know-Your-Customer (KYC) or qualified investor verification through an authorized custodian or identity provider would be necessary.

---

## 5. Checklist of Decisions Requiring Formal Legal Sign-Off

The following decisions must be reviewed and formally signed off by qualified legal counsel prior to general public availability:

- [ ] **Restricted Jurisdiction Roster**: Confirm the exact list of excluded jurisdictions (specifically whether United States, United Kingdom, European Union member states, or specific sanctioned territories require distinct treatment).
- [ ] **Enforcement Mode Determination**: Review whether "Exit-Only" mode (allowing withdrawals/repayments/sells while blocking new entries) satisfies jurisdictional obligations without causing unlawful deprivation of user property.
- [ ] **Terms of Service & Risk Disclosure Wording**: Formally review the placeholder drafts at `/terms`, `/privacy`, and `/risk-disclosure`.
- [ ] **Trademark & Non-Impersonation Policy**: Confirm the creator warning mechanism on the Launchpad to prevent unauthorized use of stock tickers and company names.
- [ ] **Sanctions Screening Requirement**: Determine whether on-chain wallet screening (e.g., via the Chainalysis on-chain sanctions oracle on Base) should be made mandatory for all stock-related contract interactions.
- [ ] **Disclaimer Placement & Prominence**: Review the acknowledgement modal copy and checkbox wording for legal enforceability under applicable electronic contracting standards.
