"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppBackground from "@/components/ui/AppBackground";
import ConnectWalletModal from "@/components/wallet/ConnectWalletModal";
import AppHeader from "@/components/wallet/AppHeader";
import { useWalletApp } from "@/hooks/useWalletApp";
import { feeShareLabels } from "@/lib/launchpad/fee-split";
import { formatPlatformFeeLabel } from "@/lib/constants/launchpad";

export default function ProfilePage() {
  const router = useRouter();
  const shares = feeShareLabels();
  const {
    wallet,
    loading,
    showModal,
    setShowModal,
    handleConnect,
    handleDisconnect,
    tab,
    setTab,
    siweAuthenticated,
    siweSigningIn,
    siweSignIn,
    setToast,
  } = useWalletApp();

  useEffect(() => {
    if (wallet?.address) {
      router.replace(`/creator/${wallet.address.toLowerCase()}`);
    }
  }, [wallet?.address, router]);

  const guest = !wallet;

  const handleSiweSignIn = useCallback(async () => {
    const result = await siweSignIn();
    if (result.ok) setToast({ msg: "Signed in — profile tools unlocked", hash: "" });
    else if (result.error && !/cancel/i.test(result.error)) {
      setToast({ msg: result.error, hash: "" });
    }
  }, [siweSignIn, setToast]);

  return (
    <main className="relative min-h-screen font-sans text-[var(--ink)]">
      <AppBackground />
      <div className="relative z-10">
        <AppHeader
          tab={tab}
          onTabChange={setTab}
          guest={guest}
          onConnect={() => setShowModal(true)}
          onDisconnect={handleDisconnect}
          walletAddress={wallet?.address}
          siweAuthenticated={siweAuthenticated}
          siweSigningIn={siweSigningIn}
          onSiweSignIn={() => void handleSiweSignIn()}
        />
        <div className="app-container py-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:py-14">
          {wallet?.address ? (
            <div className="mx-auto max-w-md text-center">
              <div className="h-12 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
              <p className="mt-4 text-sm text-[var(--ink-muted)]">Opening your profile…</p>
            </div>
          ) : (
            <div className="mx-auto max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-card)] sm:p-8">
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
