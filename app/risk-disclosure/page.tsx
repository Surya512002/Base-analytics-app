import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ShieldAlert } from "lucide-react";
import AppFooterNav from "@/components/wallet/AppFooterNav";

export const metadata: Metadata = {
  title: "Risk Disclosure (Draft) | Base Analytics",
  description: "Draft risk disclosure regarding tokenized stocks, AMM trading, and DeFi lending. Not final.",
};

export default function RiskDisclosurePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--ink)]">
      <main className="app-container flex-1 py-10 max-w-4xl space-y-8 animate-meridian-rise">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-muted)]">
          <Link href="/" className="hover:text-[var(--brand)] transition inline-flex items-center gap-1">
            <ArrowLeft size={13} />
            <span>Home</span>
          </Link>
          <span>/</span>
          <span className="text-[var(--ink)]">Risk Disclosure</span>
        </div>

        {/* Draft Notice */}
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-3">
          <AlertTriangle size={18} className="shrink-0 text-amber-600" />
          <div>
            <strong className="block font-bold">DRAFT DOCUMENT · PENDING FORMAL LEGAL REVIEW</strong>
            <span>
              This risk disclosure outlines smart contract, market, oracle, and regulatory risks for review by qualified counsel.
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-black tracking-tight text-[var(--ink)] font-display">
            Comprehensive Risk Disclosure
          </h1>
          <p className="text-xs text-[var(--ink-muted)]">
            Last Updated: October 2026 · Status: DRAFT OUTLINE FOR COUNSEL
          </p>
        </div>

        <div className="space-y-6 text-sm text-[var(--ink-muted)] leading-relaxed">
          <section className="space-y-3 p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 text-[var(--ink)] font-bold text-base">
              <ShieldAlert size={18} className="text-rose-500" />
              <h2>1. Tokenized Stocks (B20) &amp; Market Disconnect Risk</h2>
            </div>
            <p>
              Tokenized stocks on Base are B20 precompile wrapper tokens backed 1:1 by equity shares held by the issuer (e.g. Coinbase Custody). Key risks include:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-[var(--ink)]">
              <li>
                <strong>24/5 Equity vs. 24/7 AMM Trading:</strong> Traditional US stock exchanges (NYSE, NASDAQ) operate Monday through Friday during designated trading sessions. While Base AMM pools trade 24/7, prices formed outside regular US market hours reflect decentralized pool supply and demand, not active equity exchange pricing.
              </li>
              <li>
                <strong>Price Feed &amp; Oracle Staleness:</strong> Chainlink price feeds update on equity market cadence (24/5). During weekends, exchange holidays, and market halts, on-chain price feeds may remain unchanged while AMM liquidity pool ratios fluctuate.
              </li>
              <li>
                <strong>Corporate Actions &amp; Splits:</strong> Forward and reverse stock splits, dividends, mergers, or trading halts declared by underlying companies require off-chain custody settlement by the issuer. Multipliers or balances may experience settlement lag.
              </li>
            </ul>
            <p className="text-xs text-[var(--ink-dim)] italic">
              [TODO: Counsel to verify explicit disclosures regarding Reg S limitations and qualified investor restrictions.]
            </p>
          </section>

          <section className="space-y-3 p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 text-[var(--ink)] font-bold text-base">
              <ShieldAlert size={18} className="text-amber-500" />
              <h2>2. Decentralized Lending &amp; Liquidation Risk</h2>
            </div>
            <p>
              Depositing tokenized stocks as collateral to borrow USDC (e.g. via Morpho Blue or Aave V3) entails significant leverage and liquidation risks:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-[var(--ink)]">
              <li>
                <strong>Liquidation Thresholds:</strong> If the price of your collateral drops or borrow interest accrues such that your Loan-To-Value (LTV) exceeds the Liquidation LTV (e.g. 77%), your collateral can be liquidated immediately by external liquidators with penalty fees.
              </li>
              <li>
                <strong>Variable Borrow Rates:</strong> Borrow rates are dynamically determined by protocol utilization curves and can rise sharply if pool liquidity contracts.
              </li>
              <li>
                <strong>Oracle Price Freezes:</strong> If an oracle experiences downtime or equity exchanges halt trading, liquidation mechanisms may behave unpredictably.
              </li>
            </ul>
          </section>

          <section className="space-y-3 p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 text-[var(--ink)] font-bold text-base">
              <ShieldAlert size={18} className="text-blue-500" />
              <h2>3. Smart Contract &amp; Execution Risks</h2>
            </div>
            <p>
              Interacting with decentralized smart contracts carries inherent technical risks, including potential smart contract bugs, router revert errors, unexpected slippage, front-running, and blockchain network congestion.
            </p>
            <p>
              Transactions once submitted to the Base blockchain cannot be reversed, cancelled, or altered.
            </p>
          </section>
        </div>
      </main>

      <AppFooterNav />
    </div>
  );
}
