import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import AppFooterNav from "@/components/wallet/AppFooterNav";

export const metadata: Metadata = {
  title: "Privacy Policy (Draft) | Base Analytics",
  description: "Draft privacy policy pending formal legal review. Not final.",
};

export default function PrivacyPage() {
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
          <span className="text-[var(--ink)]">Privacy Policy</span>
        </div>

        {/* Draft Notice */}
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-3">
          <AlertTriangle size={18} className="shrink-0 text-amber-600" />
          <div>
            <strong className="block font-bold">DRAFT DOCUMENT · PENDING FORMAL LEGAL REVIEW</strong>
            <span>
              This privacy outline details our non-custodial data architecture for counsel review. It is not final.
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-black tracking-tight text-[var(--ink)] font-display">
            Privacy Policy
          </h1>
          <p className="text-xs text-[var(--ink-muted)]">
            Last Updated: October 2026 · Status: DRAFT OUTLINE FOR COUNSEL
          </p>
        </div>

        <div className="space-y-6 text-sm text-[var(--ink-muted)] leading-relaxed">
          <section className="space-y-2 p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <h2 className="text-base font-bold text-[var(--ink)]">1. Core Privacy Principle: Zero Personal Data Collection</h2>
            <p>
              Base Analytics is built on non-custodial, privacy-preserving principles. We do not require account registration, email addresses, names, phone numbers, or passwords.
            </p>
            <p className="text-xs text-[var(--ink-dim)] italic">
              [TODO: Counsel to confirm GDPR / CCPA exemption scope for pure non-custodial decentralized interfaces.]
            </p>
          </section>

          <section className="space-y-2 p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <h2 className="text-base font-bold text-[var(--ink)]">2. Ephemeral Geolocation Processing</h2>
            <p>
              To comply with geographic product safeguards, incoming HTTP requests are processed at the network edge by our hosting provider (Vercel) to extract the country-level header (<code>x-vercel-ip-country</code>).
            </p>
            <p>
              This country code is evaluated in volatile memory in Next.js middleware and is <strong>never recorded in a database or tied to a user identity</strong>.
            </p>
          </section>

          <section className="space-y-2 p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <h2 className="text-base font-bold text-[var(--ink)]">3. Local Device Storage (Browser LocalStorage)</h2>
            <p>
              We store minimal operational state purely on your local device:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-[var(--ink)]">
              <li>Theme preferences (light/dark mode).</li>
              <li>Tokenized stock risk acknowledgement receipt (timestamp and version string).</li>
              <li>Optional local token watchlist.</li>
            </ul>
            <p className="text-xs text-[var(--ink-dim)] italic">
              This data remains on your local device and is never synchronized to an external server without explicit action.
            </p>
          </section>

          <section className="space-y-2 p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <h2 className="text-base font-bold text-[var(--ink)]">4. Public Blockchain Records</h2>
            <p>
              Any transaction signed by your self-custody wallet (swaps, borrows, lending deposits, voucher mints) is submitted directly to the public Base blockchain. Blockchain records are permanent, public, and accessible to anyone.
            </p>
          </section>
        </div>
      </main>

      <AppFooterNav />
    </div>
  );
}
