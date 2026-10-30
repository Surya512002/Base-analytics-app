"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Copy,
  Gift,
  Zap,
  BarChart3,
  CheckCircle,
  ExternalLink,
  Wallet,
  Loader2,
  User,
  ShieldCheck,
  Send,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { parseUnits, parseEther, encodeFunctionData } from "viem";
import AppLogo from "@/components/ui/AppLogo";
import ConnectWalletModal from "@/components/wallet/ConnectWalletModal";
import { APP_URL_WEB } from "@/lib/constants/env";
import { useWalletApp } from "@/hooks/useWalletApp";
import { resolveBasenameClient } from "@/lib/utils/resolve-basename";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { buildContractCall } from "@/lib/utils/tx";
import { USDC_BASE_ADDRESS } from "@/lib/lending/constants";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function shorten(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function PayLinkPage() {
  const params = useParams();
  const raw = (params.address as string) || "";
  const address = raw.startsWith("0x") && raw.length === 42 ? (raw.toLowerCase() as `0x${string}`) : null;

  const app = useWalletApp();
  const { wallet, connType, showModal, setShowModal, loading, handleConnect } = app;
  const isConnected = !!wallet?.address;

  const [copied, setCopied] = useState(false);
  const [basename, setBasename] = useState<string | null>(null);

  // Pay form state
  const [asset, setAsset] = useState<"USDC" | "ETH">("USDC");
  const [amount, setAmount] = useState<string>("5");
  const [isSending, setIsSending] = useState(false);
  const [txSuccessHash, setTxSuccessHash] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  // Resolve Basename
  useEffect(() => {
    if (!address) return;
    let alive = true;
    resolveBasenameClient(address)
      .then((name) => {
        if (alive && name) setBasename(name);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [address]);

  const copy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!address) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center text-[var(--ink-muted)] px-4">
        Invalid wallet address.
      </div>
    );
  }

  const handlePay = async () => {
    if (!isConnected) {
      setShowModal(true);
      return;
    }

    const num = parseFloat(amount);
    if (!num || num <= 0) {
      setPayError("Enter a valid payment amount");
      return;
    }

    setIsSending(true);
    setPayError(null);
    setTxSuccessHash(null);

    try {
      const fromAddr = wallet.address as `0x${string}`;
      const calls = [];

      if (asset === "ETH") {
        const valueWei = parseEther(amount);
        calls.push(buildContractCall(address, "0x", valueWei));
      } else {
        // USDC payment
        const rawAmount = parseUnits(amount, 6);
        const transferData = encodeFunctionData({
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [address, rawAmount],
        });
        calls.push(buildContractCall(USDC_BASE_ADDRESS, transferData));
      }

      const txHash = await sendAppTransactions(connType || "injected", fromAddr, calls, {
        atomicBatch: true,
      });

      if (txHash) {
        setTxSuccessHash(txHash);
        setPayError(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Payment failed. Please try again.";
      if (!msg.toLowerCase().includes("reject") && !msg.toLowerCase().includes("cancel")) {
        setPayError(msg);
      }
    } finally {
      setIsSending(false);
    }
  };

  const usdcPresets = ["1", "5", "10", "25", "50"];
  const ethPresets = ["0.001", "0.005", "0.01", "0.025"];

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--ink)] relative overflow-hidden">
      <div className="relative z-10 max-w-lg mx-auto px-4 py-8 sm:py-14 space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <AppLogo size="md" />
            <span className="font-black text-lg tracking-[0.15em] uppercase text-[var(--ink)]">
              Base Analytics
            </span>
          </Link>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--border-subtle)]">
            Base Mainnet
          </span>
        </div>

        {/* Hero Card */}
        <div className="hero-card rounded-3xl p-5 sm:p-7 space-y-5 border border-[var(--border-subtle)] bg-[var(--surface)] shadow-lg">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-2">
              <Zap size={13} />
              <span>Tap &amp; Pay on Base</span>
            </div>
            <h1 className="text-2xl font-black text-[var(--ink)] tracking-tight">
              Pay or Tip {basename ? basename : shorten(address)}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)] mt-1">
              Send instant payments with Base Builder Code attribution.
            </p>
          </div>

          {/* Recipient Pill */}
          <div className="rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-3.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-black text-[var(--ink-dim)] uppercase tracking-wider">
                Recipient
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {basename && (
                  <span className="text-xs font-bold text-[var(--brand-text)] flex items-center gap-1 truncate">
                    <ShieldCheck size={13} />
                    {basename}
                  </span>
                )}
                <span className="font-mono text-xs text-[var(--ink-muted)] truncate">
                  {shorten(address)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={copy}
                className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition cursor-pointer"
                title="Copy address"
              >
                {copied ? <CheckCircle size={15} className="text-emerald-500" /> : <Copy size={15} />}
              </button>
              <a
                href={`https://basescan.org/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition"
                title="View on Basescan"
              >
                <ExternalLink size={15} />
              </a>
            </div>
          </div>

          {/* Interactive Tap & Pay Box */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--ink)]">Select Currency</span>
              <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded-xl border border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => {
                    setAsset("USDC");
                    setAmount("5");
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    asset === "USDC"
                      ? "bg-[#0052FF] text-white shadow-xs"
                      : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  USDC
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAsset("ETH");
                    setAmount("0.005");
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    asset === "ETH"
                      ? "bg-[#0052FF] text-white shadow-xs"
                      : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  ETH
                </button>
              </div>
            </div>

            {/* Quick Amount Pills */}
            <div className="grid grid-cols-5 gap-1.5">
              {(asset === "USDC" ? usdcPresets : ethPresets).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset)}
                  className={`py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer border ${
                    amount === preset
                      ? "border-[#0052FF] bg-[#0052FF]/10 text-[#0052FF] dark:text-[#3B82F6]"
                      : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {asset === "USDC" ? `$${preset}` : preset}
                </button>
              ))}
            </div>

            {/* Amount Input */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)] block mb-1">
                Amount ({asset})
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-[var(--surface)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-base font-mono font-bold text-[var(--ink)] outline-none focus:border-[#0052FF] transition"
                />
                <span className="absolute right-4 text-xs font-bold font-mono text-[var(--ink-muted)]">
                  {asset}
                </span>
              </div>
            </div>

            {/* Pay Action Button */}
            <button
              type="button"
              disabled={isSending}
              onClick={handlePay}
              className={`w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
                !isConnected
                  ? "bg-[#0052FF] text-white hover:bg-[#0047e0]"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {isSending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Submitting to Base…</span>
                </>
              ) : !isConnected ? (
                <>
                  <Wallet size={16} />
                  <span>Connect Wallet to Pay</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>
                    Send {amount} {asset} to {basename || shorten(address)}
                  </span>
                </>
              )}
            </button>

            {/* Success State */}
            {txSuccessHash && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                  <span>Payment Confirmed on Base!</span>
                </div>
                <p className="text-[11px] text-[var(--ink-muted)]">
                  Successfully sent {amount} {asset} to {shorten(address)}.
                </p>
                <a
                  href={`https://basescan.org/tx/${txSuccessHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[11px] underline font-bold mt-1"
                >
                  <span>View on Basescan</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            )}

            {/* Error State */}
            {payError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
                {payError}
              </div>
            )}
          </div>

          {/* Quick Shortcuts */}
          <div className="space-y-2 pt-2">
            <Link
              href={`/creator/${address.toLowerCase()}`}
              className="flex items-center gap-3 w-full p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] hover:border-[var(--brand)]/40 transition group"
            >
              <User size={18} className="text-[var(--brand-text)] shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <p className="font-bold text-[var(--ink)] text-xs group-hover:text-[var(--brand-text)] transition truncate">
                  View Creator Profile
                </p>
                <p className="text-[11px] text-[var(--ink-muted)] truncate">
                  Explore launched tokens &amp; on-chain activity
                </p>
              </div>
              <ExternalLink size={12} className="text-[var(--ink-dim)] shrink-0" />
            </Link>

            <Link
              href={`${APP_URL_WEB}/redeem`}
              className="flex items-center gap-3 w-full p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] hover:border-[var(--brand)]/40 transition group"
            >
              <Gift size={18} className="text-purple-500 shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <p className="font-bold text-[var(--ink)] text-xs group-hover:text-purple-600 transition truncate">
                  Send a Base Voucher Gift Card
                </p>
                <p className="text-[11px] text-[var(--ink-muted)] truncate">
                  Gift ETH, USDC, or tokenized stocks with secret claim link
                </p>
              </div>
              <ExternalLink size={12} className="text-[var(--ink-dim)] shrink-0" />
            </Link>

            <Link
              href={`${APP_URL_WEB}/swap`}
              className="flex items-center gap-3 w-full p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] hover:border-[var(--brand)]/40 transition group"
            >
              <Zap size={18} className="text-blue-500 shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <p className="font-bold text-[var(--ink)] text-xs group-hover:text-blue-600 transition truncate">
                  Swap &amp; Trade Tokens
                </p>
                <p className="text-[11px] text-[var(--ink-muted)] truncate">
                  Low-slippage swaps on Base mainnet
                </p>
              </div>
              <ExternalLink size={12} className="text-[var(--ink-dim)] shrink-0" />
            </Link>

            <Link
              href={`${APP_URL_WEB}/lend`}
              className="flex items-center gap-3 w-full p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] hover:border-[var(--brand)]/40 transition group"
            >
              <BarChart3 size={18} className="text-emerald-500 shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <p className="font-bold text-[var(--ink)] text-xs group-hover:text-emerald-600 transition truncate">
                  Lending &amp; Staking Terminal
                </p>
                <p className="text-[11px] text-[var(--ink-muted)] truncate">
                  Compare Aave Pro, IPOR Fusion, Beefy &amp; Aerodrome
                </p>
              </div>
              <ExternalLink size={12} className="text-[var(--ink-dim)] shrink-0" />
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--ink-dim)]">
          <Link href={APP_URL_WEB} className="hover:text-[var(--ink)] transition">
            ← Back to Base Analytics App
          </Link>
        </p>
      </div>

      <ConnectWalletModal
        open={showModal}
        loading={loading}
        onClose={() => setShowModal(false)}
        onConnect={handleConnect}
      />
    </div>
  );
}
