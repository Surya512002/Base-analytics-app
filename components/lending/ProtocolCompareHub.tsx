"use client";

import React, { useState, useMemo } from "react";
import {
  HelpCircle,
  ExternalLink,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { BASE_STOCKS, areStockSymbolsEquivalent } from "@/lib/stocks/base-stocks";
import type { NormalizedMarket } from "@/lib/lending/discovery/types";
import { AAVE_V4_LINK, AAVE_V4_SPOKE } from "@/lib/lending/aave-v4/constants";

export interface ProtocolDetail {
  id: string;
  name: string;
  tagline: string;
  category: "Auto-Compounder" | "DEX & Gauges" | "Isolated Lending" | "Pooled Lending" | "Yield Tokenization" | "Aggregator";
  status: "live_stocks" | "primitive_no_liq" | "crypto_only";
  statusLabel: string;
  badgeColor: string;
  stocksSupported: boolean;
  stockInstruments: string;
  canBorrowUsdc: boolean;
  liquidationRisk: string;
  verifiedContract: string;
  appUrl: string;
  docsUrl: string;
  description: string;
  realityNote: string;
}

export const PROTOCOL_REALITY_REGISTRY: ProtocolDetail[] = [
  {
    id: "beefy",
    name: "Beefy Finance",
    tagline: "Multichain Yield Optimizer & Auto-Compounder",
    category: "Auto-Compounder",
    status: "live_stocks",
    statusLabel: "Live on Base (Stocks Yield)",
    badgeColor: "emerald",
    stocksSupported: true,
    stockInstruments: "Aerodrome LP Auto-Compounding Vaults (ERC-4626)",
    canBorrowUsdc: false,
    liquidationRisk: "None (100% Equity LP yield compounding)",
    verifiedContract: "0x8061731243c1aeFCD50fDD4f69A7618Cdfb3EdD5",
    appUrl: "https://app.beefy.com",
    docsUrl: "https://docs.beefy.finance",
    description:
      "Beefy automatically harvests DEX trading fees and $AERO gauge emission rewards from stock/USDC pools on Aerodrome, converting them into more LP tokens and compounding yield 24/7.",
    realityNote:
      "Beefy is fully functional on Base mainnet. Vaults exist for Aerodrome pairs (e.g. MSFTc-USDC, TSLAc-USDC, MSTRc-USDC). LPs get automated yield with zero liquidation risk.",
  },
  {
    id: "aerodrome",
    name: "Aerodrome Finance",
    tagline: "Base's Primary Liquidity Hub & AMM",
    category: "DEX & Gauges",
    status: "live_stocks",
    statusLabel: "Live on Base (DEX & Gauges)",
    badgeColor: "emerald",
    stocksSupported: true,
    stockInstruments: "Slipstream & Basic Liquidity Pools + Gauges",
    canBorrowUsdc: false,
    liquidationRisk: "Impermanent loss only (No debt liquidation)",
    verifiedContract: "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
    appUrl: "https://aerodrome.finance/pools",
    docsUrl: "https://aerodrome.finance/docs",
    description:
      "Aerodrome hosts deep onchain DEX liquidity for Coinbase B20 tokenized stocks paired with USDC. LPs stake LP tokens in gauges to earn boosted $AERO emission rewards.",
    realityNote:
      "Aerodrome is the primary venue where tokenized stocks can be traded and staked on Base. Concentrated liquidity pairs allow users to earn swap fees plus gauge rewards.",
  },
  {
    id: "aave",
    name: "Aave V4 (Equities Hub)",
    tagline: "Borrow USDC against tokenized stocks",
    category: "Pooled Lending",
    status: "live_stocks",
    statusLabel: "Live on Base (Stock collateral)",
    badgeColor: "emerald",
    stocksSupported: true,
    stockInstruments: "Stock collateral for USDC loans",
    canBorrowUsdc: true,
    liquidationRisk: "Your collateral can be sold if the stock falls too far",
    verifiedContract: AAVE_V4_SPOKE,
    appUrl: AAVE_V4_LINK,
    docsUrl: "https://docs.aave.com",
    description: "Aave V4 on Base accepts selected tokenized stocks as collateral for USDC loans.",
    realityNote: "The rates and limits in the comparison above are read from Base.",
  },
  {
    id: "euler",
    name: "Euler V2",
    tagline: "Modular Lending Architecture",
    category: "Isolated Lending",
    status: "crypto_only",
    statusLabel: "Live on Base · Crypto/LST Only",
    badgeColor: "slate",
    stocksSupported: false,
    stockInstruments: "Modular Vaults (Crypto/LRT)",
    canBorrowUsdc: false,
    liquidationRisk: "Modular vault risk curve",
    verifiedContract: "",
    appUrl: "https://euler.finance",
    docsUrl: "https://docs.euler.finance",
    description:
      "Euler V2 is a modular lending suite enabling autonomous sub-vaults on Base.",
    realityNote:
      "Euler V2 is active on Base, but existing public sub-vaults focus on liquid staking and restaking collateral. No tokenized stock vaults currently hold public liquidity.",
  },
  {
    id: "pendle",
    name: "Pendle Finance",
    tagline: "Yield Tokenization & Trading Protocol",
    category: "Yield Tokenization",
    status: "crypto_only",
    statusLabel: "Live on Base · LRT/ETH Only",
    badgeColor: "slate",
    stocksSupported: false,
    stockInstruments: "PT/YT Markets (eETH, ezETH)",
    canBorrowUsdc: false,
    liquidationRisk: "Maturity-based yield decay",
    verifiedContract: "0x0000000000000000000000000000000000000000",
    appUrl: "https://app.pendle.finance",
    docsUrl: "https://docs.pendle.finance",
    description:
      "Pendle tokenizes future yield into Principal Tokens (PT) and Yield Tokens (YT) on Base.",
    realityNote:
      "Pendle on Base is dedicated to liquid restaking tokens (LRTs). Tokenized equities do not have live Pendle yield-stripping markets on Base.",
  },
  {
    id: "superform",
    name: "Superform",
    tagline: "Cross-Chain Universal Yield Marketplace",
    category: "Aggregator",
    status: "crypto_only",
    statusLabel: "Live on Base · Crypto Yield Only",
    badgeColor: "slate",
    stocksSupported: false,
    stockInstruments: "Omni-Vaults (Crypto Stablecoins)",
    canBorrowUsdc: false,
    liquidationRisk: "Underlying protocol risk pass-through",
    verifiedContract: "",
    appUrl: "https://superform.xyz",
    docsUrl: "https://docs.superform.xyz",
    description:
      "Superform routes deposits into cross-chain yield vaults using standard ERC-4626 adapters.",
    realityNote:
      "Superform aggregates yield across EVM chains, but does not operate direct tokenized stock lending pools on Base.",
  },
];

interface ProtocolCompareHubProps {
  /** Live markets only; empty while they load, so no rate is ever made up. */
  markets: NormalizedMarket[];
  onSelectStock?: (symbol: string) => void;
  onRequestConnect?: () => void;
}

export default function ProtocolCompareHub({
  markets,
  onSelectStock,
  onRequestConnect: _onRequestConnect,
}: ProtocolCompareHubProps) {
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string>("NVDAc");
  const [protocolFilter, setProtocolFilter] = useState<"all" | "live_stocks" | "lending" | "staking">("all");
  const [faqOpen, setFaqOpen] = useState<Record<string, boolean>>({
    whyDiff: true,
    whereYield: false,
  });

  const selectedStock = useMemo(() => {
    return BASE_STOCKS.find((s) => s.symbol === selectedStockSymbol) ?? BASE_STOCKS[0]!;
  }, [selectedStockSymbol]);

  const filteredProtocols = useMemo(() => {
    return PROTOCOL_REALITY_REGISTRY.filter((p) => {
      if (protocolFilter === "live_stocks") return p.status === "live_stocks";
      if (protocolFilter === "lending") return p.category === "Isolated Lending" || p.category === "Pooled Lending";
      if (protocolFilter === "staking") return p.category === "Auto-Compounder" || p.category === "DEX & Gauges";
      return true;
    });
  }, [protocolFilter]);

  // Derived stock yields across protocols
  const stockYieldMatrix = useMemo(() => {
    const sym = selectedStock.symbol;
    const matching = markets.filter(
      (m) =>
        areStockSymbolsEquivalent(m.supplyAsset.symbol, sym) ||
        (m.collateralAsset && areStockSymbolsEquivalent(m.collateralAsset.symbol, sym))
    );
    const formatTvl = (tvl?: number) => {
      if (!tvl || tvl <= 0) return "—";
      if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(1)}M`;
      if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(0)}K`;
      return `$${tvl.toFixed(0)}`;
    };
    const deepest = (protocol: string) =>
      matching.filter((m) => m.protocol === protocol).sort((a, b) => b.tvlUsd - a.tvlUsd)[0];

    return [
      { id: "beefy", name: "Beefy Finance", type: "Auto-Compounding Vault", unit: "APY", source: "Auto-Compounded LP Yield", url: "https://app.beefy.com" },
      { id: "aerodrome", name: "Aerodrome Finance", type: "DEX Gauge & Staking", unit: "APR", source: "AERO Emissions + Swap Fees", url: "https://aerodrome.finance/pools" },
      { id: "aave_v4", name: "Aave V4", type: "Stock Collateral Lending", unit: "borrow", source: "USDC loan against the stock", url: AAVE_V4_LINK },
      { id: "morpho", name: "Morpho Blue", type: "Isolated Lending", unit: "borrow", source: "USDC loan against the stock", url: "https://app.morpho.org/base" },
    ].map((p) => {
      const m = deepest(p.id);
      const rate = p.unit === "borrow" ? m?.borrowApr : m?.supplyApy;
      return {
        protocolId: p.id,
        name: p.name,
        type: p.type,
        status: m ? "live" : "unsupported",
        statusBadge: m ? "🟢 Live on Base" : "⚪ No market",
        badgeColor: m ? "emerald" : "slate",
        yieldRate: rate && rate > 0 ? `${rate.toFixed(2)}% ${p.unit === "borrow" ? "borrow APR" : p.unit}` : "—",
        yieldType: p.source,
        canBorrow: p.unit !== "borrow" || !m ? "No" : `Yes${m.maxLtv ? ` (Max LTV ${m.maxLtv}%)` : ""}`,
        tvl: formatTvl(m?.tvlUsd),
        actionText: `Open ${p.name}`,
        actionUrl: m?.sourceLink || p.url,
      };
    });
  }, [selectedStock, markets]);

  const toggleFaq = (key: string) => {
    setFaqOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6 animate-meridian-fade">
      {/* 1. HERO BANNER: REALITY CHECKER & PROTOCOL TRUTH */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand-text)] text-xs font-bold">
              <Sparkles size={13} />
              <span>Multi-Protocol Intelligence Tool</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--ink)] tracking-tight">
              Compare Tokenized Stocks Across Base Protocols
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
              Side-by-side comparison with live figures from Base. Separates <strong>stock markets (Aave V4, Morpho, Beefy &amp; Aerodrome)</strong> from crypto-only protocols.
            </p>
          </div>

        </div>

        {/* Status Callout Explaining Differences */}
        <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] flex items-start gap-2.5 text-xs text-[var(--ink)]">
          <Info size={16} className="text-[var(--brand-text)] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              Where can I lend or stake tokenized stocks on Base?
            </p>
            <p className="text-[var(--ink-muted)] leading-relaxed">
              <strong>Aave V4</strong> and <strong>Morpho</strong> lend USDC against selected stocks. <strong>Aerodrome gauges</strong> and <strong>Beefy auto-compounders</strong> pay yield on stock/USDC pool deposits.
            </p>
          </div>
        </div>
      </div>

      {/* 2. INTERACTIVE STOCK SELECTOR & REAL-TIME COMPARISON MATRIX */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--border-subtle)]">
          <div>
            <h3 className="text-base font-black text-[var(--ink)] flex items-center gap-2">
              <span>Compare Options for:</span>
              <span className="font-mono text-[var(--brand-text)]">${selectedStock.symbol}</span>
            </h3>
            <p className="text-xs text-[var(--ink-muted)]">
              {selectedStock.name} — See real yield, borrow availability, and links across every protocol.
            </p>
          </div>

          {/* Quick Stock Selector Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {BASE_STOCKS.slice(0, 12).map((s) => s.symbol).map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => {
                  setSelectedStockSymbol(sym);
                  onSelectStock?.(sym);
                }}
                className={`pop-pill px-3 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                  selectedStockSymbol === sym
                    ? "bg-[var(--brand)] text-white shadow-xs"
                    : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] border border-[var(--border-subtle)]"
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>

        {/* Side-by-Side Comparison Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {stockYieldMatrix.map((item) => (
            <div
              key={item.protocolId}
              className={`pop p-4 rounded-xl border flex flex-col justify-between space-y-3 transition ${
                item.status === "live"
                  ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/60"
                  : item.status === "primitive"
                    ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60"
                    : "border-[var(--border-subtle)] bg-[var(--surface-2)]/60 opacity-80"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-sm text-[var(--ink)]">{item.name}</h4>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md font-mono ${
                      item.badgeColor === "emerald"
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                        : item.badgeColor === "amber"
                          ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                          : "bg-[var(--surface)] text-[var(--ink-dim)] border border-[var(--border-subtle)]"
                    }`}
                  >
                    {item.statusBadge}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--ink-dim)] font-mono block mt-0.5">
                  {item.type}
                </span>

                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--ink-muted)]">Live Yield:</span>
                    <span
                      className={`font-mono font-black ${
                        item.status === "live"
                          ? "text-emerald-600 dark:text-emerald-400 text-sm"
                          : "text-[var(--ink)]"
                      }`}
                    >
                      {item.yieldRate}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--ink-dim)]">Yield Source:</span>
                    <span className="text-[var(--ink-muted)] font-medium">{item.yieldType}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--ink-dim)]">Borrow USDC:</span>
                    <span className="text-[var(--ink)] font-mono font-semibold">{item.canBorrow}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--ink-dim)]">Verified TVL:</span>
                    <span className="text-[var(--ink-muted)] font-mono">{item.tvl}</span>
                  </div>
                </div>
              </div>

              {/* Action Link */}
              <div className="pt-2 border-t border-[var(--border-subtle)]/60">
                <a
                  href={item.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    item.status === "live"
                      ? "bg-[var(--brand)] hover:opacity-90 text-white shadow-xs"
                      : "bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)] border border-[var(--border-subtle)]"
                  }`}
                >
                  <span>{item.actionText}</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. PROTOCOL DIRECTORY & STATUS REGISTRY */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-[var(--ink)]">
              Base protocols
            </h3>
            <p className="text-xs text-[var(--ink-muted)]">
              Which lending, yield and liquidity protocols on Base handle tokenized stocks.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-2)] p-1 rounded-xl border border-[var(--border-subtle)]">
            {[
              { id: "all", label: "All Protocols" },
              { id: "live_stocks", label: "🟢 Live for Stocks" },
              { id: "staking", label: "Staking & Vaults" },
              { id: "lending", label: "Lending Markets" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setProtocolFilter(f.id as "all" | "live_stocks" | "lending" | "staking")}
                className={`pop-pill px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  protocolFilter === f.id
                    ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Protocols Table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-2)] text-[11px] font-black uppercase tracking-wider text-[var(--ink-muted)]">
                <th className="py-2.5 px-3">Protocol</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Base Mainnet Status</th>
                <th className="py-2.5 px-3">Tokenized Stocks Support</th>
                <th className="py-2.5 px-3 text-right">App &amp; Contracts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]/60">
              {filteredProtocols.map((p) => (
                <tr key={p.id} className="pop-row group transition">
                  <td className="py-3 px-3">
                    <div>
                      <span className="font-bold text-sm text-[var(--ink)] block">{p.name}</span>
                      <span className="text-[11px] text-[var(--ink-dim)]">{p.tagline}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
                      {p.category}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-md ${
                        p.badgeColor === "emerald"
                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                          : p.badgeColor === "amber"
                            ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                            : "bg-[var(--surface-2)] text-[var(--ink-dim)]"
                      }`}
                    >
                      {p.statusLabel}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-xs text-[var(--ink)]">{p.stockInstruments}</span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={p.appUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded bg-[var(--surface-2)] hover:bg-[var(--surface)] text-[var(--brand-text)] font-bold text-[11px] inline-flex items-center gap-1 border border-[var(--border-subtle)]"
                      >
                        <span>Open App</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. VERIFICATION FAQ: ANSWERS TO THE USER'S EXACT CONCERNS */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-xs space-y-3">
        <h3 className="text-base font-black text-[var(--ink)] flex items-center gap-2">
          <HelpCircle size={17} className="text-[var(--brand-text)]" />
          <span>Protocol Verification &amp; FAQ</span>
        </h3>

        {/* Q1 */}
        <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleFaq("whyDiff")}
            className="w-full p-3.5 bg-[var(--surface-2)] flex items-center justify-between text-left text-xs font-bold text-[var(--ink)] cursor-pointer"
          >
            <span>How does borrowing against a stock work?</span>
            {faqOpen.whyDiff ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {faqOpen.whyDiff && (
            <div className="p-3.5 text-xs text-[var(--ink-muted)] space-y-2 bg-[var(--surface)] border-t border-[var(--border-subtle)] leading-relaxed">
              <p>
                You supply a stock as collateral on <strong>Aave V4</strong> or <strong>Morpho</strong> and borrow USDC against it. Each market sets its own limit and rate.
              </p>
              <p>
                If the stock&apos;s price falls past the market&apos;s limit, your collateral can be sold to repay the loan. Borrow well below the maximum.
              </p>
            </div>
          )}
        </div>

        {/* Q2 */}
        <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleFaq("whereYield")}
            className="w-full p-3.5 bg-[var(--surface-2)] flex items-center justify-between text-left text-xs font-bold text-[var(--ink)] cursor-pointer"
          >
            <span>Where CAN I earn real yield on tokenized stocks on Base today?</span>
            {faqOpen.whereYield ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {faqOpen.whereYield && (
            <div className="p-3.5 text-xs text-[var(--ink-muted)] space-y-2 bg-[var(--surface)] border-t border-[var(--border-subtle)] leading-relaxed">
              <p>
                Real on-chain yield for tokenized stocks currently lives in two major venues:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <strong>Beefy Finance:</strong> Auto-compounding vaults on Base that hold Aerodrome LP tokens (e.g. MSFTc-USDC, TSLAc-USDC, MSTRc-USDC). Beefy automatically harvests trading fees and AERO emissions and compounds them back into your position. The rate changes daily and the deposit can lose value as prices move.
                </li>
                <li>
                  <strong>Aerodrome Finance:</strong> Base&apos;s leading DEX. Users deposit stock tokens paired with USDC into Slipstream concentrated liquidity pools and stake their LP tokens in gauges to earn $AERO emission rewards.
                </li>
              </ul>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
