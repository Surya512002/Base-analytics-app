import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ShieldCheck, ExternalLink, ArrowLeft, Lock, Info } from "lucide-react";
import AppFooterNav from "@/components/wallet/AppFooterNav";
import { DEFAULT_RESTRICTED_REGIONS } from "@/src/config/compliance";

export const metadata: Metadata = {
  title: "Restricted Jurisdictions & Regional Safeguards | Base Analytics",
  description:
    "Product safeguards, regional availability, and exit-only fund access policy for tokenized stock features on Base.",
};

export default function RestrictedRegionsPage() {
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
          <span className="text-[var(--ink)]">Restricted Regions</span>
        </div>

        {/* Hero Banner */}
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-gradient-to-br from-amber-500/10 via-[var(--surface)] to-[var(--surface-2)] p-6 sm:p-8 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            <AlertCircle size={13} />
            <span>PRODUCT SAFEGUARDS · PENDING LEGAL REVIEW</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--ink)] font-display">
            Geographic Availability &amp; Regional Safeguards
          </h1>

          <p className="text-sm text-[var(--ink-muted)] leading-relaxed max-w-2xl">
            Tokenized stock features (such as AMM trading, lending collateral, stock-paired token launches, and stock vouchers) are restricted for users located in or residents of certain jurisdictions based on applicable regulatory requirements and issuer terms.
          </p>
        </div>

        {/* Exit-Only Fund Guarantee */}
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <ShieldCheck size={20} className="shrink-0" />
            <h2 className="text-base font-bold text-[var(--ink)]">
              Exit-Only Policy: Your Funds Are Never Trapped
            </h2>
          </div>
          <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
            Our platform operates under a strict <strong>Exit-Only policy</strong>. Even if your region is restricted or a feature is switched off:
          </p>
          <ul className="text-xs text-[var(--ink)] space-y-1.5 list-disc pl-5">
            <li>You can always <strong>withdraw</strong> deposited collateral or supply from lending protocols.</li>
            <li>You can always <strong>repay</strong> existing borrows and close positions.</li>
            <li>You can always <strong>sell</strong> tokenized stock holdings back to USDC or ETH on decentralized venues.</li>
            <li>You can always <strong>claim and redeem</strong> existing crypto gift vouchers.</li>
          </ul>
          <p className="text-[11px] text-[var(--ink-dim)] italic pt-1">
            We only restrict new inflows, new borrows, new purchases, and creating new stock-backed products.
          </p>
        </div>

        {/* Technical Perimeter Honesty */}
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-6 space-y-3">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Info size={18} className="shrink-0" />
            <h2 className="text-base font-bold text-[var(--ink)]">
              Technical Limitations of Geo-Gating
            </h2>
          </div>
          <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
            We believe in honest, transparent disclosures: server-side IP geolocation (via Vercel network headers) is one product safeguard layer, but it is <strong>not foolproof</strong>. Geolocation perimeters can be bypassed through commercial VPNs, Tor, or proxies.
          </p>
          <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
            Users remain personally responsible for their compliance with the laws of their local jurisdiction and the terms set forth by token issuers.
          </p>
        </div>

        {/* Restricted Jurisdictions List */}
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 space-y-4">
          <h2 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
            <Lock size={16} className="text-amber-500" />
            <span>Restricted Jurisdictions (Draft List for Legal Review)</span>
          </h2>

          <p className="text-xs text-[var(--ink-muted)]">
            The following jurisdictions are restricted by default in our product configuration pending formal sign-off from legal counsel:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            {DEFAULT_RESTRICTED_REGIONS.map((code) => {
              const names: Record<string, string> = {
                US: "United States (US)",
                CU: "Cuba (CU)",
                IR: "Iran (IR)",
                KP: "North Korea (KP)",
                SY: "Syria (SY)",
                RU: "Russia (RU)",
                BY: "Belarus (BY)",
                MM: "Myanmar (MM)",
                VE: "Venezuela (VE)",
              };
              return (
                <div
                  key={code}
                  className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--ink)]"
                >
                  {names[code] || code}
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-[var(--ink-dim)] pt-2">
            TODO: Complete roster and specific sub-regional territories (e.g., Crimea, Donetsk, Luhansk) to be confirmed with qualified legal counsel.
          </p>
        </div>

        {/* Legal Links */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[var(--ink-muted)] pt-2">
          <Link href="/terms" className="hover:text-[var(--brand)] transition">
            Terms of Service (Draft)
          </Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-[var(--brand)] transition">
            Privacy Policy (Draft)
          </Link>
          <span>·</span>
          <Link href="/risk-disclosure" className="hover:text-[var(--brand)] transition">
            Risk Disclosure (Draft)
          </Link>
          <span>·</span>
          <a
            href="https://www.coinbase.com/legal/tokenized-stocks"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--brand)] transition inline-flex items-center gap-1"
          >
            <span>Coinbase Tokenized Stocks Terms</span>
            <ExternalLink size={11} />
          </a>
        </div>
      </main>

      <AppFooterNav />
    </div>
  );
}
