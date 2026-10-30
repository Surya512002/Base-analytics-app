"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppBackground from "@/components/ui/AppBackground";
import ConnectWalletModal from "@/components/wallet/ConnectWalletModal";
import AppHeader from "@/components/wallet/AppHeader";
import { useWalletApp, type AppTab } from "@/hooks/useWalletApp";
import { feeShareLabels } from "@/lib/launchpad/fee-split";
import { formatPlatformFeeLabel } from "@/lib/constants/launchpad";
import { hrefForAppTab, readPersistedWalletAddress } from "@/lib/utils/wallet-persist";
import { Users } from "lucide-react";
import { useUniqueUsers } from "@/hooks/useUniqueUsers";

export default function ProfilePage() {
  const router = useRouter();
  const shares = feeShareLabels();
  const { formatted: totalUsersFormatted } = useUniqueUsers();
  const {
    wallet,
    loading,
    showModal,
    setShowModal,
    handleConnect,
    handleDisconnect,
    tab,
    setTab,
    sessionBootstrapped,
    siweAuthenticated,
    siweSigningIn,
    siweSignIn,
    setToast,
  } = useWalletApp();

  useEffect(() => {
    if (!sessionBootstrapped) return;
    const addr = wallet?.address ?? readPersistedWalletAddress();
    if (addr) {
      router.replace(`/creator/${addr.toLowerCase()}`);
    }
  }, [wallet?.address, router, sessionBootstrapped]);

  const guest = sessionBootstrapped ? !wallet : false;

  const handleTabChange = useCallback(
    (next: AppTab) => {
      if (guest && next !== "launchpad" && next !== "swap" && next !== "lend") {
        setShowModal(true);
        return;
      }
      setTab(next);
      router.push(hrefForAppTab(next));
    },
    [guest, router, setShowModal, setTab]
  );

  const handleSiweSignIn = useCallback(async () => {
    const result = await siweSignIn();
    if (result.ok) setToast({ msg: "Signed in — profile tools unlocked", hash: "" });
    else if (result.error && !/cancel/i.test(result.error)) {
      setToast({ msg: result.error, hash: "" });
    }
  }, [siweSignIn, setToast]);

  return (
    <main className="relative min-h-screen font-sans text-[var(--ink)] overflow-x-clip">
      <AppBackground />
      <div className="relative z-10 w-full min-w-0">
        <AppHeader
          tab={tab}
          onTabChange={handleTabChange}
          guest={guest}
          onConnect={() => setShowModal(true)}
          onDisconnect={handleDisconnect}
          walletAddress={wallet?.address}
          siweAuthenticated={siweAuthenticated}
          siweSigningIn={siweSigningIn}
          onSiweSignIn={() => void handleSiweSignIn()}
        />
        <div className="app-container py-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:py-14 w-full min-w-0">
          {!sessionBootstrapped || wallet?.address || readPersistedWalletAddress() ? (
            <div className="mx-auto max-w-md text-center">
              <div className="h-12 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
              <p className="mt-4 text-sm text-[var(--ink-muted)]">
                {!sessionBootstrapped ? "Restoring session…" : "Opening your profile…"}
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-card)] sm:p-8">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Users size={13} />
                <span>{totalUsersFormatted} Unique Users Connected on Base</span>
              </div>
              <h1 className="text-2xl font-bold text-[var(--ink)]">Creator profile</h1>
              <p className="mt-2 text-sm text-[var(--ink-muted)]">
                Connect wallet, then sign in (free, no gas) to create your public profile and track
                creator revenue.
              </p>
              <p className="mt-3 text-[12px] text-[var(--ink-dim)]">
                B20 launches earn <strong className="text-[var(--ink)]">{shares.creator}</strong> of
                every {formatPlatformFeeLabel()} swap fee — paid instantly on each trade.
              </p>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="btn-primary mt-6 px-6 py-3"
              >
                Connect wallet
              </button>
            </div>
          )}
        </div>
      </div>
      <ConnectWalletModal
        open={showModal}
        loading={loading}
        onClose={() => setShowModal(false)}
        onConnect={handleConnect}
      />
    </main>
  );
}
