import Link from "next/link";
import AppLogo from "@/components/ui/AppLogo";
import SafetyNote from "@/components/ui/SafetyNote";
import { GROUPS } from "@/lib/nav/directory";
import { ShieldCheck, ExternalLink, Github } from "lucide-react";

/** High-contrast, theme-adaptive site footer matching Blue Hour Meridian design tokens. */
export default function AppFooterNav() {
  return (
    <footer className="mt-auto w-full border-t border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pb-0 transition-colors">
      <div className="app-container grid gap-8 py-8 md:grid-cols-[1fr_1.4fr] md:py-10">
        <div>
          <div className="flex items-center gap-2.5">
            <AppLogo size="sm" />
            <span className="font-display text-lg font-black tracking-tight text-[var(--ink)]">
              Base Analytics
            </span>
            <span className="inline-flex items-center gap-1 text-[13px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Mainnet
            </span>
          </div>
          <p className="mt-3 max-w-md text-sm text-[var(--ink-muted)] leading-relaxed">
            Coinbase tokenized stocks, DEX trading, Morpho &amp; Aave lending, token launches with
            creator revenue, and crypto gift vouchers on Base.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={14} className="shrink-0 text-emerald-500" />
            <span>Transactions carry our Base Builder Code · Chain ID: 8453</span>
          </div>
          <SafetyNote className="mt-3 max-w-md" />
        </div>

        <nav aria-label="All pages" className="grid grid-cols-2 gap-x-4 gap-y-6 text-sm sm:grid-cols-3">
          {GROUPS.map((group) => (
            <div key={group.id} className="flex flex-col items-start">
              <span className="pb-1 text-[13px] font-bold text-[var(--ink)]">{group.title}</span>
              {group.entries.map((e) => (
                <Link key={e.id} href={e.href} className="flex min-h-[32px] items-center font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--brand-text)]">
                  {e.title}
                </Link>
              ))}
              {group.id === "help" && (
                <>
                  <a href="https://github.com/Surya512002/Base-analytics-app" target="_blank" rel="noreferrer" className="inline-flex min-h-[32px] items-center gap-1.5 font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--brand-text)]">
                    <Github size={13} className="shrink-0" /> GitHub <ExternalLink size={11} className="opacity-70" />
                  </a>
                  <a href="https://basescan.org" target="_blank" rel="noreferrer" className="inline-flex min-h-[32px] items-center gap-1 font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--brand-text)]">
                    BaseScan <ExternalLink size={11} className="opacity-70" />
                  </a>
                </>
              )}
            </div>
          ))}
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
              className="inline-flex items-center gap-1.5 font-semibold text-[var(--ink)] hover:text-[var(--brand-text)] transition-colors"
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
