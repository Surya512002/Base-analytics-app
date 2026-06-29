"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Copy, Gift, Zap, BarChart3, CheckCircle } from "lucide-react";
import { useState } from "react";
import AppLogo from "@/components/ui/AppLogo";
import { APP_URL_WEB } from "@/lib/constants/env";

function shorten(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function PayLinkPage() {
  const params = useParams();
  const raw = (params.address as string) || "";
  const address = raw.startsWith("0x") && raw.length === 42 ? raw.toLowerCase() : null;
  const [copied, setCopied] = useState(false);

  if (!address) {
    return (
      <div className="min-h-screen bg-[#071220] flex items-center justify-center text-slate-400 px-4">
        Invalid wallet address.
      </div>
    );
  }

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#040a14] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora pointer-events-none" />
      <div className="absolute inset-0 bg-grid-future opacity-25 pointer-events-none" />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-12 sm:py-16">
        <div className="flex items-center gap-3 mb-10">
          <AppLogo size="md" />
          <span className="font-black text-lg tracking-[0.15em] uppercase">Base Analytics</span>
        </div>

        <div className="hero-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div>
            <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2">
              Base Pay Link
            </p>
            <h1 className="text-2xl font-black text-white">Send on Base</h1>
            <p className="text-sm text-slate-400 mt-2">
              Gift cards, x402 payments, and wallet analytics — all on Base.
            </p>
          </div>

          <div className="rounded-xl bg-black/35 border border-white/10 p-4">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
              Wallet
            </p>
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-sm text-cyan-300 break-all">{address}</p>
              <button
                type="button"
                onClick={copy}
                className="shrink-0 p-2 rounded-lg bg-white/10 border border-white/15 hover:bg-white/15"
              >
                {copied ? <CheckCircle size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">{shorten(address)} on Base mainnet</p>
          </div>

          <div className="space-y-2">
            <Link
              href={`${APP_URL_WEB}/?tab=voucher`}
              className="flex items-center gap-3 w-full p-4 rounded-2xl glass-panel-accent border border-cyan-500/25 hover:border-cyan-500/40 transition"
            >
              <Gift size={20} className="text-cyan-400 shrink-0" />
              <div className="text-left">
                <p className="font-black text-white text-sm">Send a Base Voucher</p>
                <p className="text-[11px] text-slate-400">ETH or USDC gift cards — from $1</p>
              </div>
            </Link>
            <Link
              href={`${APP_URL_WEB}/?tab=dashboard`}
              className="flex items-center gap-3 w-full p-4 rounded-2xl glass-panel border border-white/10 hover:border-white/20 transition"
            >
              <Zap size={20} className="text-amber-400 shrink-0" />
              <div className="text-left">
                <p className="font-black text-white text-sm">x402 Payment</p>
                <p className="text-[11px] text-slate-400">Pay from $0.01 USDC — decentralized</p>
              </div>
            </Link>
            <Link
              href={`${APP_URL_WEB}/?tab=dashboard`}
              className="flex items-center gap-3 w-full p-4 rounded-2xl glass-panel border border-white/10 hover:border-white/20 transition"
            >
              <BarChart3 size={20} className="text-rose-400 shrink-0" />
              <div className="text-left">
                <p className="font-black text-white text-sm">Free wallet scan</p>
                <p className="text-[11px] text-slate-400">Score, badges & leaderboard</p>
              </div>
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-8">
          <Link href={APP_URL_WEB} className="hover:text-slate-300">
            Open Base Analytics →
          </Link>
        </p>
      </div>
    </div>
  );
}
