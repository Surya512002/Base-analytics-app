import Link from "next/link";
import { Droplets, Power, Rocket, Wallet, Zap } from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";
import { getDaysLeft } from "@/lib/utils/season";

interface AppHeaderProps {
  weeklyXP?: number;
  sponsored?: number;
  walletRefreshing?: boolean;
  scanProgress?: string;
  onDisconnect?: () => void;
  guest?: boolean;
  onConnect?: () => void;
  showCommandPalette?: boolean;
}

export default function AppHeader({
  weeklyXP = 0,
  sponsored = 0,
  walletRefreshing = false,
  scanProgress = "",
  onDisconnect,
  guest,
  onConnect,
  showCommandPalette,
}: AppHeaderProps) {
  return (
    <header className="app-header sticky top-0 z-40 bg-[var(--bg-deep)]/90 backdrop-blur-xl border-b border-white/10 shadow-[0_4px_32px_rgba(0,0,0,0.45)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/explore" className="flex items-center gap-2.5 min-w-0 hover:opacity-90 transition-opacity">
            <AppLogo size="sm" />
            <span className="font-black text-sm sm:text-base text-white truncate tracking-wide">
              BASE<span className="text-[var(--ink)]">.</span>ANALYTICS
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {showCommandPalette && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
              className="hidden sm:flex items-center gap-1.5 glass-panel rounded-xl px-2.5 py-1.5 text-slate-400 hover:text-white border border-white/10"
            >
              <span className="text-[10px]">Search</span>
              <kbd className="text-[9px] font-mono border border-white/10 rounded px-1">⌘K</kbd>
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1.5 badge-live rounded-xl px-2.5 py-1.5">
            <Rocket size={10} className="text-[var(--ink-muted)]" />
            <span className="text-[10px] font-semibold whitespace-nowrap uppercase tracking-wide text-[var(--ink-muted)]">
              B20 Launchpad
            </span>
            <span className="text-emerald-300/50 mx-0.5">·</span>
            <span className="text-[10px] text-slate-300">{getDaysLeft()}d left</span>
          </div>
          <div className="flex items-center gap-1 glass-panel-accent rounded-xl px-2.5 py-1.5">
            <Zap size={11} className="text-[var(--ink-muted)]" />
            <span className="text-[10px] font-black text-[var(--ink)]">{weeklyXP}</span>
            <span className="text-[9px] text-slate-400 hidden sm:inline">XP</span>
          </div>
          {!guest && walletRefreshing && (
            <div className="hidden sm:flex items-center gap-1 glass-panel rounded-xl px-2.5 py-1.5 border border-[var(--border-subtle)] max-w-[220px]">
              <div className="w-1.5 h-1.5 bg-[var(--ink-muted)] rounded-full animate-pulse shrink-0" />
              <span className="text-[9px] font-bold text-[var(--ink-muted)] uppercase tracking-wide truncate">
                {scanProgress || "Syncing history"}
              </span>
            </div>
          )}
          {!guest && sponsored > 0 && (
            <div className="hidden sm:flex items-center gap-1 glass-panel rounded-xl px-2.5 py-1.5">
              <Droplets size={11} className="text-[var(--ink-muted)]" />
              <span className="text-[10px] text-[var(--ink-muted)] font-bold">{sponsored}</span>
            </div>
          )}
          {guest ? (
            <button
              type="button"
              onClick={onConnect}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-[11px] sm:text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-ink)] transition-colors"
            >
              <Wallet size={14} />
              Connect
            </button>
          ) : (
            <button
              onClick={onDisconnect}
              className="p-2 glass-panel rounded-xl text-slate-400 hover:text-white hover:border-[var(--border-strong)] transition-colors"
              aria-label="Disconnect wallet"
            >
              <Power size={14} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
