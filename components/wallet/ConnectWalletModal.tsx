"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Droplets, Globe, X } from "lucide-react";
import {
  BaseAppWalletIcon,
  FarcasterWalletIcon,
  MetaMaskWalletIcon,
} from "@/components/wallet/WalletBrandIcon";
import { isInsideBaseMiniApp, detectMiniAppHost, type MiniAppHost } from "@/lib/utils/mini-app-connect";
import type { ConnectionType } from "@/lib/types/wallet";

type WalletOption = {
  type: ConnectionType;
  label: string;
  short: string;
  icon: ReactNode;
};

const BASE_WALLET: WalletOption = {
  type: "baseAccount",
  label: "Base Wallet",
  short: "Passkey or email · recommended",
  icon: <BaseAppWalletIcon size={22} />,
};

const OTHER_WALLETS: WalletOption[] = [
  {
    type: "coinbase",
    label: "Extension",
    short: "Coinbase Wallet",
    icon: <BaseAppWalletIcon size={20} />,
  },
  {
    type: "metamask",
    label: "MetaMask",
    short: "Browser ext.",
    icon: <MetaMaskWalletIcon size={20} />,
  },
  {
    type: "injected",
    label: "Other",
    short: "Rabby, Rainbow…",
    icon: <Globe size={16} className="text-[var(--ink-dim)]" />,
  },
  {
    type: "farcaster",
    label: "Farcaster",
    short: "Warpcast",
    icon: <FarcasterWalletIcon size={20} />,
  },
];

function WalletGridButton({
  wallet,
  loading,
  onConnect,
}: {
  wallet: WalletOption;
  loading: boolean;
  onConnect: (type: ConnectionType) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onConnect(wallet.type)}
      disabled={loading}
      className="flex items-center gap-2 px-2.5 py-2.5 rounded-lg border border-white/[0.08] bg-black/20 hover:bg-white/[0.04] hover:border-white/20 text-left transition-colors disabled:opacity-50"
    >
      <span className="w-7 h-7 rounded-md bg-white flex items-center justify-center shrink-0 overflow-hidden">
        {wallet.icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold text-[var(--ink)] truncate">{wallet.label}</span>
        <span className="block text-[9px] text-[var(--ink-dim)] truncate">{wallet.short}</span>
      </span>
    </button>
  );
}

export default function ConnectWalletModal({
  open,
  loading,
  onClose,
  onConnect,
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConnect: (type: ConnectionType) => void;
}) {
  const [inMiniApp, setInMiniApp] = useState(false);
  const [miniAppHost, setMiniAppHost] = useState<MiniAppHost | null>(null);

  useEffect(() => {
    void (async () => {
      const inside = await isInsideBaseMiniApp();
      setInMiniApp(inside);
      if (inside) {
        setMiniAppHost(await detectMiniAppHost());
        try {
          const { sdk } = await import("@farcaster/miniapp-sdk");
          await sdk.actions.ready?.();
        } catch {
          /* optional */
        }
      } else {
        setMiniAppHost(null);
      }
    })();
  }, []);

  const embeddedWallet = useMemo((): WalletOption => {
    if (miniAppHost === "warpcast") {
      return {
        type: "farcaster",
        label: "Farcaster Wallet",
        short: "Warpcast on Base",
        icon: <FarcasterWalletIcon size={22} />,
      };
    }
    return {
      type: "farcaster",
      label: "Base App Wallet",
      short: "Smart wallet in mini-app",
      icon: <BaseAppWalletIcon size={22} />,
    };
  }, [miniAppHost]);

  if (!open) return null;

  const hint = inMiniApp
    ? miniAppHost === "warpcast"
      ? "Connect your Warpcast wallet to trade on Base."
      : "Connect your Base App smart wallet."
    : "Sign in to launch, swap, and earn XP. Browse stays open without connecting.";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-3 sm:p-6 overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-label="Connect wallet"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[6px]"
        onClick={onClose}
        aria-label="Close"
      />

      <div
        className="relative w-full max-w-[340px] rounded-xl border border-white/[0.1] bg-[var(--bg-raised)] overflow-hidden tab-content-enter my-auto"
        style={{
          marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)",
          maxHeight:
            "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 1.5rem)",
        }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.08]">
          <div>
            <p className="text-[14px] font-semibold text-[var(--ink)]">Connect wallet</p>
            <p className="text-[11px] text-[var(--ink-dim)] mt-0.5">Base mainnet only</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[var(--ink-dim)] hover:text-[var(--ink)] hover:bg-white/[0.06] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div
          className="px-4 py-3 overflow-y-auto overscroll-contain"
          style={{
            maxHeight:
              "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 9rem)",
          }}
        >
          <p className="text-[12px] text-[var(--ink-muted)] leading-relaxed mb-3">{hint}</p>

          {inMiniApp ? (
            <button
              type="button"
              onClick={() => onConnect(embeddedWallet.type)}
              disabled={loading}
              className="w-full flex items-center gap-2.5 px-3 py-3 rounded-lg bg-[var(--ink)] hover:bg-white text-[#080808] font-semibold text-[13px] transition-colors disabled:opacity-50"
            >
              <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 border border-black/10">
                {embeddedWallet.icon}
              </span>
              <span className="text-left min-w-0 flex-1">
                <span className="block">{embeddedWallet.label}</span>
                <span className="block text-[10px] font-medium text-[#080808]/60">
                  {embeddedWallet.short}
                </span>
              </span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onConnect(BASE_WALLET.type)}
                disabled={loading}
                className="w-full flex items-center gap-2.5 px-3 py-3 rounded-lg bg-[var(--ink)] hover:bg-white text-[#080808] font-semibold text-[13px] transition-colors disabled:opacity-50"
              >
                <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 border border-black/10">
                  {BASE_WALLET.icon}
                </span>
                <span className="text-left min-w-0 flex-1">
                  <span className="block">{BASE_WALLET.label}</span>
                  <span className="block text-[10px] font-medium text-[#080808]/60">
                    {BASE_WALLET.short}
                  </span>
                </span>
              </button>

              <div className="mt-4 pt-3 border-t border-white/[0.08]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-dim)] mb-2">
                  Other wallets
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {OTHER_WALLETS.map((w) => (
                    <WalletGridButton
                      key={w.type}
                      wallet={w}
                      loading={loading}
                      onConnect={onConnect}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-2 border-t border-white/[0.08] flex items-center justify-center gap-1.5">
          <Droplets size={10} className="text-[var(--ink-dim)] shrink-0" />
          <p className="text-[10px] text-[var(--ink-dim)] font-medium">
            Gas sponsored on Base Wallet
          </p>
        </div>
      </div>
    </div>
  );
}
