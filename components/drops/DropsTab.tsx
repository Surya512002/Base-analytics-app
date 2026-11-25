"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Compass, Gift, PackageOpen, type LucideIcon } from "lucide-react";
import ActivePill from "@/components/ui/motion/ActivePill";
import type { WalletAppState } from "@/hooks/useWalletApp";
import Link from "next/link";
import { DROPS_CONTRACT, parseDropLink, type ParsedDropLink } from "@/lib/drops/client";
import { IS_DROPS_TESTNET } from "@/lib/drops/network";
import DropCreate from "./DropCreate";
import DropsHero from "./DropsHero";
import DropsFeed from "./DropsFeed";
import { restoreAfterLinking } from "./LinkedAccounts";
import DropClaim from "./DropClaim";
import MyDrops from "./MyDrops";
import { Card, Notice, btnPrimary } from "./ui";

type View = "explore" | "create" | "mine";

const TABS: Array<[View, string, LucideIcon]> = [
  ["explore", "Explore", Compass],
  ["create", "Create", Gift],
  ["mine", "My drops", PackageOpen],
];

/**
 * Drops: rule-based gifts. /drops shows create + my drops; /drops/:id#k=… opens the claim page.
 * Secrets in links stay in the URL fragment, which browsers never send to the server.
 */
export default function DropsTab({
  app,
  guestMode,
  onRequestConnect,
}: {
  app: WalletAppState;
  guestMode: boolean;
  onRequestConnect: () => void;
}) {
  const address = app.wallet?.address ?? null;
  const connType = app.connType ?? null;
  const [link, setLink] = useState<(ParsedDropLink & { id: string }) | null>(null);
  const [view, setView] = useState<View>("explore");
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const read = () => {
      // Back from X / Discord / Telegram: restore the drop link fragment kept in this tab.
      restoreAfterLinking();
      const parsed = parseDropLink(window.location.pathname, window.location.hash);
      setLink(parsed.id ? { ...parsed, id: parsed.id } : null);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const testnet = IS_DROPS_TESTNET ? (
    <Notice tone="warn">Test network: Drops here run on Base Sepolia with test funds. Switch your wallet to Base Sepolia.</Notice>
  ) : null;

  // No contract on this deployment: say so once, instead of a page of controls that cannot work.
  if (!DROPS_CONTRACT) {
    return (
      <div className="mx-auto max-w-xl space-y-4 pb-12">
        <Card className="space-y-3 text-center">
          <Gift size={28} aria-hidden className="mx-auto text-[var(--brand-text)]" />
          <h2 className="text-xl font-black text-[var(--ink)]">Drops are coming soon</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            Airdrops with your own rules, daily claims and tasks are not switched on yet. Nothing here can take or move your funds.
          </p>
          <p className="text-sm text-[var(--ink-muted)]">To send someone crypto or stocks today, use a gift voucher.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/?tab=basehub" className={btnPrimary}>
              Send a gift voucher
            </Link>
            <Link href="/redeem" className="inline-flex min-h-[44px] items-center rounded-xl border border-[var(--border-subtle)] px-5 text-sm font-bold text-[var(--ink)]">
              Redeem a card
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (link) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pb-12">
        {testnet}
        <DropClaim link={link} address={address} connType={connType} onRequestConnect={onRequestConnect} />
      </div>
    );
  }

  const signedIn = !guestMode && Boolean(address);
  const goView = (v: View) => {
    setView(v);
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12">
      {testnet}
      <DropsHero view={view} signedIn={signedIn} onCreate={() => goView("create")} onMine={() => goView("mine")} onExplore={() => goView("explore")} />

      {!signedIn || !address ? (
        <>
          <DropsFeed canCreate={false} onCreate={onRequestConnect} />
          <Card className="text-center">
            <p className="text-sm text-[var(--ink-muted)]">Connect a wallet to claim, create drops and see yours. Got a drop link? Paste it above.</p>
            <button type="button" className={`${btnPrimary} mx-auto`} onClick={onRequestConnect}>
              Connect wallet
            </button>
          </Card>
        </>
      ) : (
        <>
          <div ref={tabsRef} className="scroll-mt-20">
            <div role="tablist" aria-label="Drops" className="glass-panel flex gap-1 overflow-x-auto rounded-2xl p-1 no-scrollbar">
              {TABS.map(([id, label, Icon]) => {
                const selected = view === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setView(id)}
                    className={`relative isolate flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 text-sm font-bold transition-colors ${
                      selected ? "text-[var(--ink)]" : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {selected && <ActivePill layoutId="drops-view-pill" className="tab-active" />}
                    <Icon size={16} className={selected ? "text-[var(--brand-text)]" : ""} aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-center text-xs text-[var(--ink-muted)]">
            X, Discord and Telegram accounts for tasks are linked from your{" "}
            <a className="font-bold text-[var(--brand-text)] underline" href={`/creator/${address.toLowerCase()}`}>
              profile
            </a>
            .
          </p>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {view === "explore" && <DropsFeed canCreate onCreate={() => goView("create")} />}
              {view === "create" && <DropCreate address={address} connType={connType} onCreated={() => undefined} />}
              {view === "mine" && <MyDrops address={address} connType={connType} />}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
