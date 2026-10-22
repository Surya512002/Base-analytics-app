"use client";

import React, { useState, useRef, useEffect } from "react";
import type { VoucherAsset } from "@/lib/utils/voucher";
import {
  formatVoucherAmount,
  isStockAsset,
  isVaultShareAsset,
  getVaultShareBySymbol,
} from "@/lib/utils/voucher";
import { getBaseStockBySymbol } from "@/lib/stocks/base-stocks";
import AppLogo from "@/components/ui/AppLogo";
import { Sparkles, ShieldCheck, AlertCircle } from "lucide-react";
import type { CardTheme } from "./voucher-types";
import { CARD_THEME_OPTIONS } from "./voucher-constants";

interface VoucherCardPreviewProps {
  cardId?: string;
  asset: VoucherAsset;
  amount?: bigint;
  message?: string;
  theme?: CardTheme;
  redeemed?: boolean;
  compact?: boolean;
  showSecret?: boolean;
  secret?: string;
  showRedeemedNotice?: boolean;
  flat?: boolean;
}

export default function VoucherCardPreview({
  cardId,
  asset = "USDC",
  amount,
  message,
  theme = "base-blue",
  redeemed = false,
  compact = false,
  showSecret = false,
  secret,
  showRedeemedNotice = false,
  flat = false,
}: VoucherCardPreviewProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }
  }, []);

  const isVault = isVaultShareAsset(asset);
  const isStock = isStockAsset(asset);
  const stockInfo = !isVault && isStock ? getBaseStockBySymbol(asset) : null;
  const vaultInfo = isVault ? getVaultShareBySymbol(asset) : null;

  // Selected theme config
  const themeConfig =
    CARD_THEME_OPTIONS.find((t) => t.id === theme) || CARD_THEME_OPTIONS[0];

  const displayAmount = amount
    ? formatVoucherAmount(asset, amount)
    : asset === "ETH"
      ? "0.01 ETH"
      : isVault
        ? `1.0 ${asset} Vault Share`
        : isStock
          ? `1.0 ${asset} Share`
          : "$10 USDC";

  const amountMain = isStock
    ? displayAmount.split(" ")[0]
    : displayAmount.replace(" USDC", "").replace(" ETH", "");
  const amountUnit = isVault
    ? `${asset} · ${vaultInfo?.name ?? "Vault"}`
    : isStock
      ? `${asset} ${stockInfo ? `· ${stockInfo.name}` : ""}`
      : asset;

  // Mouse move tilt calculation (only on desktop non-reduced-motion)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (flat || prefersReducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    // Restrained subtle tilt (max ~7 degrees)
    const rotateX = -(y / (rect.height / 2)) * 6;
    const rotateY = (x / (rect.width / 2)) * 6;
    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div className="w-full space-y-3">
      {showRedeemedNotice && redeemed && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
          <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-amber-500">Card already redeemed</p>
            <p className="text-[11px] text-[var(--ink-muted)] mt-0.5">
              This gift card has already been claimed to a recipient wallet.
            </p>
          </div>
        </div>
      )}

      {/* 3D Container with Perspective */}
      <div
        style={{ perspective: flat ? undefined : "1000px" }}
        className="w-full flex justify-center"
      >
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className={`relative w-full rounded-2xl overflow-hidden border shadow-xl transition-transform duration-200 ease-out select-none ${
            compact ? "max-w-[340px] p-4" : "max-w-[420px] p-5 sm:p-6"
          }`}
          style={{
            background: themeConfig.gradient,
            borderColor: themeConfig.borderColor,
            transform:
              flat || prefersReducedMotion
                ? "none"
                : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transformStyle: flat ? undefined : "preserve-3d",
          }}
        >
          {/* Subtle Ambient Radial Highlight */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_10%,rgba(255,255,255,0.12),transparent_65%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_100%,rgba(0,82,255,0.15),transparent_50%)] pointer-events-none" />

          {/* Top Line: Brand & Network Badge */}
          <div className="relative flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300/80">
                {isVault ? "Yield Vault Position" : isStock ? "RWA Equity Share" : "Onchain Gift Card"}
              </span>
              <p className="text-sm font-black text-white truncate mt-0.5">
                {isVault
                  ? `${vaultInfo?.protocol ?? "DeFi"} Vault`
                  : isStock
                    ? "Base Tokenized Stock"
                    : "Base Voucher"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-[10px] font-bold text-white">
                <span className="w-2 h-2 rounded-full bg-[var(--brand)]" />
                Base
              </div>
              <div className="w-7 h-7 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center p-1">
                <AppLogo size="sm" />
              </div>
            </div>
          </div>

          {/* APY badge if vault */}
          {vaultInfo && (
            <div className="relative mb-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <Sparkles size={11} /> +{vaultInfo.apy.toFixed(2)}% APY
              </span>
            </div>
          )}

          {/* Main Amount (Tabular Numbers) */}
          <div className="relative my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-white tabular-nums tracking-tight">
                {amountMain}
              </span>
              {isStock && (
                <span className="text-sm font-bold text-slate-200">Share</span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-200 mt-1 truncate">
              {amountUnit}
            </p>
          </div>

          {/* Card Message */}
          {message?.trim() ? (
            <div className="relative my-3 rounded-xl bg-black/40 border border-white/15 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-0.5">
                Message
              </p>
              <p className="text-xs text-white italic line-clamp-2 leading-relaxed">
                &quot;{message.trim()}&quot;
              </p>
            </div>
          ) : (
            <div className="relative my-3 rounded-xl bg-black/30 border border-white/10 p-2 text-center">
              <p className="text-[11px] text-slate-300 italic">
                &quot;Happy day! Enjoy your onchain gift.&quot;
              </p>
            </div>
          )}

          {/* Bottom Bar: Status and Card ID */}
          <div className="relative pt-3 border-t border-white/15 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 font-bold">
              <span
                className={`w-2 h-2 rounded-full ${
                  redeemed ? "bg-slate-400" : "bg-[var(--success)] animate-pulse"
                }`}
              />
              <span className={redeemed ? "text-slate-300" : "text-emerald-300"}>
                {redeemed ? "Redeemed" : "Active"}
              </span>
            </div>

            <div className="font-mono text-[10px] text-slate-200">
              {cardId ? `ID: ${cardId}` : "Pre-deposit Preview"}
            </div>
          </div>
        </div>
      </div>

      {/* Secret Card ID pill below preview if available */}
      {cardId && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-2.5 flex items-center justify-between text-xs font-mono">
          <span className="text-[var(--ink-muted)] font-bold text-[10px] uppercase tracking-wider">
            Card ID: {cardId}
          </span>
          {showSecret && secret ? (
            <span className="text-[var(--ink)] font-bold">{secret}</span>
          ) : (
            <span className="text-[var(--ink-dim)]">•••••-•••••-•••••-•••••</span>
          )}
        </div>
      )}
    </div>
  );
}
