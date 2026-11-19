"use client";

import React, { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { parseDropLink, type ParsedDropLink } from "@/lib/drops/client";
import { IS_DROPS_TESTNET } from "@/lib/drops/network";
import DropCreate from "./DropCreate";
import DropClaim from "./DropClaim";
import MyDrops from "./MyDrops";
import { Card, Notice, btnPrimary, btnSecondary } from "./ui";

type View = "create" | "mine";

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
  const [view, setView] = useState<View>("create");

  useEffect(() => {
    const read = () => {
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

  if (link) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 pb-12">
        {testnet}
        <DropClaim link={link} address={address} connType={connType} onRequestConnect={onRequestConnect} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-12">
      {testnet}
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-text)]">
            <Sparkles size={20} />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-black text-[var(--ink)]">Drops</h1>
            <p className="text-sm text-[var(--ink-muted)]">
              Give ETH, USDC or any token with your own rules: one link or unique codes, holders or a list, daily claims, and
              verified tasks like follows, buys, posts and quizzes. Funds stay in an onchain escrow until claimed or returned to you.
            </p>
          </div>
        </div>
        {!guestMode && address && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={view === "create" ? btnPrimary : btnSecondary} onClick={() => setView("create")}>
              New drop
            </button>
            <button type="button" className={view === "mine" ? btnPrimary : btnSecondary} onClick={() => setView("mine")}>
              My drops
            </button>
          </div>
        )}
      </Card>

      {guestMode || !address ? (
        <Card>
          <p className="text-sm text-[var(--ink-muted)]">Connect a wallet to create drops and see yours.</p>
          <button type="button" className={btnPrimary} onClick={onRequestConnect}>
            Connect wallet
          </button>
        </Card>
      ) : view === "create" ? (
        <DropCreate address={address} connType={connType} onCreated={() => undefined} />
      ) : (
        <MyDrops address={address} connType={connType} />
      )}
    </div>
  );
}
