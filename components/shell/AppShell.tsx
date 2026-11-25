"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AppTab } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import CommandPalette from "@/components/shell/CommandPalette";
import MobileBottomNav from "@/components/shell/MobileBottomNav";
import { syncTabUrl } from "@/lib/utils/app-url";

export default function AppShell({
  tab,
  onTabChange,
  guest,
  onConnect,
  onOpenToken,
  tokens,
  children,
  header,
  walletAddress,
}: {
  tab: AppTab;
  onTabChange: (t: AppTab) => void;
  guest?: boolean;
  onConnect?: () => void;
  onCreateToken?: () => void;
  onOpenToken?: (token: LaunchedToken) => void;
  tokens?: LaunchedToken[];
  children: ReactNode;
  header: ReactNode;
  walletAddress?: string | null;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  const handleTabChange = (t: AppTab) => {
    // Vouchers has its own page for visitors, so it opens without a wallet too.
    if (guest && t !== "launchpad" && t !== "swap" && t !== "basehub") {
      onConnect?.();
      return;
    }
    onTabChange(t);
    syncTabUrl(t);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    const openPalette = () => setPaletteOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", openPalette);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", openPalette);
    };
  }, []);

  return (
    <>
      {header}

      <div data-command-palette-host className="app-container flex w-full min-w-0 flex-1 flex-col pt-5 sm:pt-6 md:pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10">
        {children}
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        tab={tab}
        onTabChange={handleTabChange}
        tokens={tokens ?? []}
        onOpenToken={onOpenToken}
      />

      <MobileBottomNav tab={tab} onTabChange={handleTabChange} walletAddress={walletAddress} />
    </>
  );
}
