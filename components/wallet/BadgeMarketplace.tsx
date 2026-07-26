"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, ShoppingBag, Store, Tag } from "lucide-react";
import { encodeFunctionData, parseUnits } from "viem";
import type { WalletAppState } from "@/hooks/useWalletApp";
import {
  ACHIEVEMENTS_ABI,
  ACHIEVEMENTS_CONTRACT,
  BADGE_MARKETPLACE_ABI,
  ERC20_ABI,
  USDC_BASE,
} from "@/lib/constants/contracts";
import { BADGE_MARKETPLACE_CONTRACT } from "@/lib/constants/env";
import {
  fetchOwnedBadges,
  openSeaBadgeUrl,
  type OwnedBadge,
} from "@/lib/wallet/owned-badges";
import {
  fetchOnchainBadgeListings,
  type OnchainBadgeListing,
} from "@/lib/wallet/onchain-badge-listings";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { buildContractCall } from "@/lib/utils/tx";

type Listing = {
  id: string;
  seller: string;
  tokenId: number;
  catName: string;
  tierName: string;
  tierIcon: string;
  priceUsdc: string;
};

type Panel = "browse" | "owned" | "sell";

export default function BadgeMarketplace({ app }: { app: WalletAppState }) {
  const { wallet, connType, showToast } = app;
  const [panel, setPanel] = useState<Panel>("browse");
  const [listings, setListings] = useState<Listing[]>([]);
  const [onchainListings, setOnchainListings] = useState<OnchainBadgeListing[]>([]);
  const [owned, setOwned] = useState<OwnedBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellTokenId, setSellTokenId] = useState("");
  const [sellPrice, setSellPrice] = useState("1");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      const [listRes, ownedBadges, chainListings] = await Promise.all([
        fetch("/api/badge-market").then((r) => r.json()),
        fetchOwnedBadges(wallet.address),
        fetchOnchainBadgeListings(),
      ]);
      setListings(listRes.listings ?? []);
      setOnchainListings(chainListings);
      setOwned(ownedBadges);
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!wallet) return null;

  const handleListOffchain = async () => {
    const tokenId = parseInt(sellTokenId, 10);
    const badge = owned.find((b) => b.tokenId === tokenId);
    if (!badge) {
      showToast("Select a badge you own", "");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/badge-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller: wallet.address,
          tokenId: badge.tokenId,
          catId: badge.catId,
          catName: badge.catName,
          tierName: badge.tierName,
          tierIcon: badge.tierIcon,
          priceUsdc: sellPrice,
        }),
      });
      if (!res.ok) throw new Error("list failed");
      showToast("Listed for sale", "");
      void refresh();
    } catch {
      showToast("Failed to list badge", "");
    } finally {
      setBusy(false);
    }
  };

  const handleOnchainList = async () => {
    if (!BADGE_MARKETPLACE_CONTRACT || !connType) return;
    const tokenId = parseInt(sellTokenId, 10);
    const price = parseUnits(sellPrice || "0", 6);
    setBusy(true);
    try {
      const approveData = encodeFunctionData({
        abi: ACHIEVEMENTS_ABI,
        functionName: "setApprovalForAll",
        args: [BADGE_MARKETPLACE_CONTRACT as `0x${string}`, true],
      });
      const listData = encodeFunctionData({
        abi: BADGE_MARKETPLACE_ABI,
        functionName: "list",
        args: [BigInt(tokenId), price],
      });
      await sendAppTransactions(connType, wallet.address, [
        buildContractCall(ACHIEVEMENTS_CONTRACT as `0x${string}`, approveData),
        buildContractCall(BADGE_MARKETPLACE_CONTRACT as `0x${string}`, listData),
      ]);
      showToast("Badge listed on-chain", "");
    } catch {
      showToast("On-chain list failed", "");
    } finally {
      setBusy(false);
    }
  };

  const handleOnchainBuy = async (listingId: number, priceUsdc: string) => {
    if (!BADGE_MARKETPLACE_CONTRACT || !connType) {
      showToast("On-chain marketplace not configured", "");
      return;
    }
    const price = parseUnits(priceUsdc, 6);
    setBusy(true);
    try {
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [BADGE_MARKETPLACE_CONTRACT as `0x${string}`, price],
      });
      const buyData = encodeFunctionData({
        abi: BADGE_MARKETPLACE_ABI,
        functionName: "buy",
        args: [BigInt(listingId)],
      });
      await sendAppTransactions(connType, wallet.address, [
        buildContractCall(USDC_BASE as `0x${string}`, approveData),
        buildContractCall(BADGE_MARKETPLACE_CONTRACT as `0x${string}`, buyData),
      ]);
      showToast("Badge purchased!", "");
      void refresh();
    } catch {
      showToast("Purchase failed", "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="editorial-hero overflow-hidden mb-6">
      <div className="accent-bar" />
      <div className="px-5 py-4 border-b border-white/8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Store size={16} className="text-white/60" />
            Badge marketplace
          </h3>
          <p className="text-[10px] text-slate-500">
            Trade achievement NFTs · {BADGE_MARKETPLACE_CONTRACT ? "on-chain escrow" : "off-chain listings"}
          </p>
        </div>
        <div className="flex gap-1 glass-panel p-1 rounded-xl">
          {(
            [
              { id: "browse" as const, label: "Browse", icon: ShoppingBag },
              { id: "owned" as const, label: "Owned", icon: Tag },
              { id: "sell" as const, label: "Sell", icon: Store },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPanel(id)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${
                panel === id
                  ? "tab-active"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              }`}
            >
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>
      </div>

      {!BADGE_MARKETPLACE_CONTRACT && (
        <div className="mx-4 mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3">
          <p className="text-sm font-bold text-[var(--ink)]">On-chain marketplace coming soon</p>
          <p className="readable-body text-xs mt-1">
            Mint badges in the catalog and share them — listings go live when the marketplace contract
            is deployed.
          </p>
        </div>
      )}

      <div className="p-4">
        {loading ? (
          <div className="h-24 rounded-2xl bg-white/[0.03] animate-pulse" />
        ) : panel === "browse" ? (
          onchainListings.length === 0 && listings.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No badges listed yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {onchainListings.map((l) => (
                <div
                  key={`chain-${l.listingId}`}
                  className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4"
                >
                  <span className="text-[8px] font-black uppercase text-emerald-400">On-chain</span>
                  <div className="flex items-center gap-2 mb-2 mt-1">
                    <span className="text-xl">{l.tierIcon}</span>
                    <div>
                      <p className="text-sm font-black text-white">{l.tierName}</p>
                      <p className="text-[10px] text-slate-500">{l.catName}</p>
                    </div>
                  </div>
                  <p className="text-lg font-black text-emerald-300 font-mono">${l.priceUsdc}</p>
                  {l.seller.toLowerCase() !== wallet.address.toLowerCase() && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleOnchainBuy(l.listingId, l.priceUsdc)}
                      className="mt-3 text-[10px] font-black px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-200"
                    >
                      Buy with USDC
                    </button>
                  )}
                </div>
              ))}
              {listings.map((l) => (
                <div
                  key={l.id}
                  className="rounded-2xl border border-white/10 bg-black/25 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{l.tierIcon}</span>
                    <div>
                      <p className="text-sm font-black text-white">{l.tierName}</p>
                      <p className="text-[10px] text-slate-500">{l.catName}</p>
                    </div>
                  </div>
                  <p className="text-lg font-black text-emerald-300 font-mono">${l.priceUsdc}</p>
                  <p className="text-[10px] text-slate-600 font-mono mt-1">
                    #{l.tokenId} · {l.seller.slice(0, 8)}…
                  </p>
                  <div className="flex gap-2 mt-3">
                    <a
                      href={openSeaBadgeUrl(l.tokenId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-slate-400 hover:text-white inline-flex items-center gap-1"
                    >
                      OpenSea <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : panel === "owned" ? (
          owned.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No badges in wallet yet — mint some above.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {owned.map((b) => (
                <div
                  key={b.tokenId}
                  className="rounded-2xl border border-white/10 bg-black/25 p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{b.tierIcon}</span>
                    <div>
                      <p className="text-sm font-black text-white">{b.tierName}</p>
                      <p className="text-[10px] text-slate-500">{b.catName} · ×{b.balance}</p>
                    </div>
                  </div>
                  <a
                    href={openSeaBadgeUrl(b.tokenId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex text-[10px] font-bold text-[#6BA3FF] hover:text-white items-center gap-1"
                  >
                    View on OpenSea <ExternalLink size={10} />
                  </a>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="max-w-md space-y-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Badge to sell
            </label>
            <select
              value={sellTokenId}
              onChange={(e) => setSellTokenId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            >
              <option value="">Select owned badge</option>
              {owned.map((b) => (
                <option key={b.tokenId} value={String(b.tokenId)}>
                  {b.tierIcon} {b.tierName} (#{b.tokenId})
                </option>
              ))}
            </select>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Price (USDC)
            </label>
            <input
              type="text"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-mono text-white"
            />
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleListOffchain()}
                className="px-4 py-2 rounded-xl text-xs font-black bg-white/10 text-white hover:bg-white/15 disabled:opacity-40"
              >
                List (catalog)
              </button>
              {BADGE_MARKETPLACE_CONTRACT && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleOnchainList()}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-40"
                >
                  List on-chain (escrow)
                </button>
              )}
            </div>
            {!BADGE_MARKETPLACE_CONTRACT && (
              <p className="text-[10px] text-slate-600">
                Set <code className="text-slate-400">NEXT_PUBLIC_BADGE_MARKETPLACE_CONTRACT</code> for
                escrow trading.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
