import Link from "next/link";
import AppLogo from "@/components/ui/AppLogo";
import { ShieldCheck, ExternalLink, Github } from "lucide-react";

/** High-contrast, theme-adaptive site footer matching Blue Hour Meridian design tokens. */
export default function AppFooterNav() {
  return (
    <footer className="mt-auto w-full border-t border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] pb-28 md:pb-0 transition-colors">
      <div className="app-container grid gap-8 py-8 md:grid-cols-[1.4fr_1fr] md:py-10">
        <div>
          <div className="flex items-center gap-2.5">
            <AppLogo size="sm" />
            <span className="font-display text-lg font-black tracking-tight text-[var(--ink)]">
              Base Analytics
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Mainnet
            </span>
          </div>
          <p className="mt-3 max-w-md text-sm text-[var(--ink-muted)] leading-relaxed">
            Coinbase tokenized stocks, DEX trading, Morpho &amp; Aave lending, token launches with
            creator revenue, and crypto gift vouchers on Base.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={14} className="shrink-0 text-emerald-500" />
            <span>Verified Base Builder Attribution · Chain ID: 8453</span>
          </div>
        </div>

        <nav className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm sm:justify-items-end">
          <div className="space-y-2.5 flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-dim)]">
              Products
            </span>
            <Link href="/explore" className="text-[var(--ink-muted)] hover:text-[var(--brand)] transition-colors font-medium">
              Explore
            </Link>
            <Link href="/swap" className="text-[var(--ink-muted)] hover:text-[var(--brand)] transition-colors font-medium">
              Swap
            </Link>
            <Link href="/launch" className="text-[var(--ink-muted)] hover:text-[var(--brand)] transition-colors font-medium">
              Launchpad
            </Link>
          </div>

          <div className="space-y-2.5 flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-dim)]">
              Finance
            </span>
            <Link href="/lend" className="text-[var(--ink-muted)] hover:text-[var(--brand)] transition-colors font-medium">
              Lend &amp; Stake
            </Link>
            <Link href="/redeem" className="text-[var(--ink-muted)] hover:text-[var(--brand)] transition-colors font-medium">
              Redeem Voucher
            </Link>
          </div>

          <div className="space-y-2.5 flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-dim)]">
              Legal &amp; Safety
            </span>
            <Link href="/restricted-regions" className="text-[var(--ink-muted)] hover:text-[var(--brand)] transition-colors font-medium">
              Restricted Regions
            </Link>
            <Link href="/risk-disclosure" className="text-[var(--ink-muted)] hover:text-[var(--brand)] transition-colors font-medium">
              Risk Disclosure
            </Link>
            <Link href="/terms" className="text-[var(--ink-muted)] hover:text-[var(--brand)] transition-colors font-medium">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-[var(--ink-muted)] hover:text-[var(--brand)] transition-colors font-medium">
              Privacy Policy
            </Link>
          </div>

          <div className="space-y-2.5 flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-dim)]">
              Resources
            </span>
            <Link href="/docs" className="text-[var(--ink-muted)] hover:text-[var(--brand)] transition-colors font-medium">
              Documents
            </Link>
            <Link href="/docs#compliance" className="text-[var(--ink-muted)] hover:text-[var(--brand)] transition-colors font-medium">
              Compliance &amp; Safety Docs
            </Link>
            <a
              href="https://github.com/Surya512002/Base-analytics-app"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--ink-muted)] hover:text-[var(--brand)] transition-colors font-medium inline-flex items-center gap-1.5"
            >
              <Github size={13} className="shrink-0" />
              <span>GitHub</span>
              <ExternalLink size={11} className="opacity-70" />
            </a>
            <a
              href="https://basescan.org"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--ink-muted)] hover:text-[var(--brand)] transition-colors font-medium inline-flex items-center gap-1"
            >
              <span>BaseScan</span>
              <ExternalLink size={11} className="opacity-70" />
            </a>
          </div>
        </nav>
      </div>

      <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-2)]/60">
        <div className="app-container flex flex-col sm:flex-row items-center justify-between gap-3 py-4 text-xs text-[var(--ink-muted)]">
          <div className="flex flex-wrap items-center gap-2">
            <p>© {new Date().getFullYear()} Base Analytics · Built on Base mainnet</p>
            <span className="hidden sm:inline text-[var(--ink-dim)]">·</span>
            <a
              href="https://github.com/Surya512002/Base-analytics-app"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-[var(--ink)] hover:text-[var(--brand)] transition-colors"
            >
              <Github size={14} className="text-[var(--ink-muted)]" />
              <span>Verify Open Source on GitHub</span>
              <ExternalLink size={11} className="opacity-70" />
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-dim)]">
            <span>Non-custodial interface</span>
            <span>·</span>
            <span>Not financial, legal or tax advice</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
