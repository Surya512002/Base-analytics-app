# App Copy Review & Promotional Claim Audit

> **AUDIT PURPOSE**: Identify and sanitize absolute, promotional, tax, and securities-related claims in accordance with product compliance guardrails.  
> **RULE**: The app must never claim to be "compliant", guaranteed, or tax-advantaged. Rates are variable and based on live on-chain market data. Add "Not financial, legal or tax advice" notices across stock features.

---

## 1. Audit Table of Identified & Replaced Claims

| File Path | Previous Text / Risky Claim | Category / Risk | Suggested Neutral Replacement | Implemented Status |
| :--- | :--- | :--- | :--- | :--- |
| `components/lending/StockBorrowSpotlight.tsx` | *"borrow USDC at sub-3% rates without triggering capital gains taxes. Plus lend stocks for up to 11.2% APY"* | Tax advice claim (`capital gains`, `without triggering`) & Promotional fixed APY (`sub-3%`, `up to 11.2% APY`) | *"borrow USDC at variable DeFi market rates. Compare live protocol lending yields... Not financial, legal or tax advice. Rates are variable based on live market utilization."* | **Replaced** |
| `components/lending/StockBorrowSpotlight.tsx` | *"Securities lending to market makers"* | Regulatory claim (`securities lending`) | *"Decentralized lending market rates"* | **Replaced** |
| `lib/lending/markets.ts:1073-1074` | *"SEC-compliant 1:1 securities backed tokenized equity shares yielding securities lending interest."* | Regulatory claim (`SEC-compliant`, `securities lending`) | *"1:1 custody-backed tokenized equity shares with decentralized protocol lending yield."* | **Replaced** |
| `lib/lending/markets.ts:671` | *"Heavy shorting demand generates industry-leading securities lending returns on Palantir."* | Absolute return claim (`industry-leading securities lending returns`) | *"Lend PLTRc into isolated Morpho Blue markets with live protocol utilization yields."* | **Replaced** |
| `lib/lending/markets.ts:700` | *"Maximum yield securities lending vault driven by intense MicroStrategy volatility arbitrage."* | Promotional yield claim (`Maximum yield securities lending vault`) | *"Lend MSTRc into isolated Morpho Blue markets with live protocol utilization yields."* | **Replaced** |
| `lib/lending/markets.ts:729` | *"Supply Circle tokenized shares to earn 8.5% passive securities lending interest."* | Promotional claim (`passive securities lending interest`) | *"Supply CRCLc into isolated Morpho Blue markets with live protocol utilization yields."* | **Replaced** |
| `lib/lending/unified-comparison.ts:236` | *"Guaranteed lender APY return across maturity date."* | Absolute guarantee claim (`Guaranteed`) | *"Fixed term lender APR across maturity date subject to protocol solvency."* | **Replaced** |
| `components/lending/ProtocolCard.tsx:75` | *"Locks in a guaranteed fixed APR until maturity."* | Absolute guarantee claim (`guaranteed fixed APR`) | *"Fixed term APR until maturity."* | **Replaced** |
| `components/lending/ProtocolCard.tsx:77` | *"Accumulates securities lending fees and Base rewards automatically."* | Regulatory terminology (`securities lending fees`) | *"Routes stock collateral across verified lending protocols and Base gauges."* | **Replaced** |
| `components/stocks/StocksLendingHub.tsx:346` | *"Compare live securities lending yields and USDC borrow rates..."* | Terminology (`securities lending yields`) | *"Compare live protocol lending yields and variable USDC borrow rates... Not financial, legal or tax advice."* | **Replaced** |
| `components/stocks/StocksLendingHub.tsx:376` | *"Securities Lending Hub"* | Header branding | *"Tokenized Stocks Lending Hub"* | **Replaced** |
| `components/wallet/AppFooterNav.tsx:125` | *(Missing general disclaimer)* | Legal disclaimer gap | Added *"Non-custodial interface · Not financial, legal or tax advice"* | **Added** |

---

## 2. Global Copy Guidelines for Developers

1. **Never Make Tax Claims**: Never use terms like "without triggering capital gains", "tax-free", "tax-deferred", or "no tax". Users are responsible for their individual tax liabilities.
2. **Never Guarantee Yields**: Avoid "guaranteed", "risk-free", or "safe". All smart contract interactions and variable DeFi yields carry liquidation, smart contract, and protocol solvency risks.
3. **Use Neutral Token Labels**: Refer to tokens as **"Tokenized stock (B20)"** with issuer information from the registry (e.g. "Issued by Coinbase Custody standard"). Do not use proprietary corporate logos unless explicitly authorized; use neutral ticker badges.
4. **Disclose Variable Rates**: Always indicate that APYs, APRs, and borrow rates fluctuate dynamically with decentralized pool utilization.
5. **Prominent Disclaimers**: Include the standard phrase *"Not financial, legal or tax advice"* on interfaces involving stock swaps, lending, or borrow positions.
