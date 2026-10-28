import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import AppFooterNav from "@/components/wallet/AppFooterNav";

export const metadata: Metadata = {
  title: "Terms of Service (Draft) | Base Analytics",
  description: "Draft terms of service pending formal legal review. Not final.",
};

export default function TermsPage() {
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
          <span className="text-[var(--ink)]">Terms of Service</span>
        </div>

        {/* Draft Notice */}
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-3">
          <AlertTriangle size={18} className="shrink-0 text-amber-600" />
          <div>
            <strong className="block font-bold">DRAFT DOCUMENT · PENDING FORMAL LEGAL REVIEW</strong>
            <span>
              This document is an outline of proposed terms for review by qualified legal counsel. It is not final and does not constitute legal advice.
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-black tracking-tight text-[var(--ink)] font-display">
            Terms of Service
          </h1>
          <p className="text-xs text-[var(--ink-muted)]">
            Last Updated: October 2026 · Status: DRAFT OUTLINE FOR COUNSEL
          </p>
        </div>

        <div className="space-y-6 text-sm text-[var(--ink-muted)] leading-relaxed">
          <section className="space-y-2 p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <h2 className="text-base font-bold text-[var(--ink)]">1. Interface Nature &amp; Non-Custodial Software</h2>
            <p>
              Base Analytics provides a graphical user interface interacting with publicly deployed decentralized smart contracts on the Base mainnet (Chain ID 8453).
            </p>
            <p>
              The platform does not custody, control, transmit, or hold user private keys, cryptocurrencies, tokenized stock assets, or fiat currencies at any time.
            </p>
            <p className="text-xs text-[var(--ink-dim)] italic">
              [TODO: Counsel to specify precise legal entity or open-source foundation status and governing law jurisdiction.]
            </p>
          </section>

          <section className="space-y-2 p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <h2 className="text-base font-bold text-[var(--ink)]">2. Geographic Restrictions &amp; Prohibited Parties</h2>
            <p>
              Access to tokenized stock features is strictly prohibited for persons located in, residents of, or nationals of restricted or sanctioned jurisdictions (including the United States and OFAC-sanctioned countries).
            </p>
            <p>
              Circumventing geographic safeguards via virtual private networks (VPNs) or other proxy tools is a direct violation of these Terms.
            </p>
            <p className="text-xs text-[var(--ink-dim)] italic">
              [TODO: Counsel to confirm exact statutory references for OFAC, EU, UK, and local securities laws.]
            </p>
          </section>

          <section className="space-y-2 p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <h2 className="text-base font-bold text-[var(--ink)]">3. No Financial, Legal, or Tax Advice</h2>
            <p>
              No content, yield comparison, rate display, or analytics chart provided on this interface constitutes investment, financial, legal, or tax advice. All displayed borrow rates, lending APYs, and swap prices represent variable estimates derived from live decentralized protocol data.
            </p>
            <p className="text-xs text-[var(--ink-dim)] italic">
              [TODO: Counsel to add standard securities disclaimers under US Securities Act, MiCA, and applicable international laws.]
            </p>
          </section>

          <section className="space-y-2 p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <h2 className="text-base font-bold text-[var(--ink)]">4. Third-Party Protocols &amp; Token Issuers</h2>
            <p>
              Tokenized stock precompile tokens (B20) are issued and backed under the independent terms of their respective issuers. Base Analytics does not guarantee token backing, off-chain corporate action settlement, or issuer redemption availability.
            </p>
            <p className="text-xs text-[var(--ink-dim)] italic">
              [TODO: Counsel to confirm limitation of liability and indemnification clauses for third-party smart contracts.]
            </p>
          </section>

          <section className="space-y-2 p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <h2 className="text-base font-bold text-[var(--ink)]">5. Exit-Only Protocol Guarantee</h2>
            <p>
              In the event of regulatory changes or regional restriction triggers, the interface maintains an exit-only posture ensuring users retain the technical ability to withdraw assets, repay borrow positions, unstake, and sell holdings to exit positions.
            </p>
          </section>
        </div>
      </main>

      <AppFooterNav />
    </div>
  );
}
