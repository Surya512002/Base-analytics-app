import Link from "next/link";
import { BookOpen, Compass, HelpCircle, Trophy } from "lucide-react";

export default function AppFooterNav() {
  return (
    <footer className="mt-8 pt-6 border-t border-white/8">
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full elegant-panel text-[11px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] border border-[var(--border-subtle)] transition"
        >
          <Compass size={13} /> Explore
        </Link>
        <Link
          href="/help"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full elegant-panel text-[11px] font-bold text-slate-400 hover:text-white border border-white/10 transition"
        >
          <HelpCircle size={13} /> Help & FAQ
        </Link>
        <Link
          href="/hall-of-fame"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full elegant-panel text-[11px] font-bold text-slate-400 hover:text-white border border-white/10 transition"
        >
          <Trophy size={13} className="text-[var(--ink-muted)]" /> Hall of Fame
        </Link>
        <Link
          href="/help#api"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full elegant-panel text-[11px] font-bold text-slate-400 hover:text-white border border-white/10 transition"
        >
          <BookOpen size={13} /> API docs
        </Link>
      </div>
      <p className="text-center text-[10px] text-slate-600 mt-4">
        Base Analytics · B20 Launchpad · Vouchers · Onchain identity on Base
      </p>
    </footer>
  );
}
