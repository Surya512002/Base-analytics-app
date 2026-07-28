import Link from "next/link";
import AppLogo from "@/components/ui/AppLogo";

/** Paylane-style dark site footer. */
export default function AppFooterNav() {
  return (
    <footer className="mt-auto w-full border-t border-[var(--border-subtle)] bg-[var(--ink)] text-white">
      <div className="app-container grid gap-8 py-8 md:grid-cols-[1.4fr_1fr] md:py-10">
        <div>
          <div className="flex items-center gap-2.5">
            <AppLogo size="sm" />
            <span className="font-display text-lg font-bold">Base Analytics</span>
          </div>
          <p className="mt-3 max-w-md text-sm text-white/70">
            Launch B20 tokens, swap on Base, and analyze your wallet — quests, vouchers, and x402
            insights in one mini-app.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-3 text-sm text-white/80 sm:justify-items-end">
          <Link href="/explore" className="hover:text-white">
            Explore
          </Link>
          <Link href="/swap" className="hover:text-white">
            Swap
          </Link>
          <Link href="/docs" className="hover:text-white">
            Documents
          </Link>
          <Link href="/hall-of-fame" className="hover:text-white">
            Hall of Fame
          </Link>
          <Link href="/docs#api" className="hover:text-white">
            API docs
          </Link>
          <Link href="/redeem" className="hover:text-white">
            Redeem voucher
          </Link>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="app-container py-4 text-xs text-white/45">
          © {new Date().getFullYear()} Base Analytics · Built on Base mainnet
        </p>
      </div>
    </footer>
  );
}
