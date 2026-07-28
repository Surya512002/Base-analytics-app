"use client";

import Link from "next/link";
import AppBackground from "@/components/ui/AppBackground";
import AppHeader from "@/components/wallet/AppHeader";
import ConnectWalletModal from "@/components/wallet/ConnectWalletModal";
import ToastNotification from "@/components/wallet/ToastNotification";
import CreatorProfilePanel from "@/components/launchpad/CreatorProfilePanel";
import { useWalletApp } from "@/hooks/useWalletApp";

export default function CreatorPageClient({ address }: { address: string }) {
  const {
    wallet,
    loading,
    showModal,
    setShowModal,
    handleConnect,
    handleDisconnect,
    toast,
    setToast,
    tab,
    setTab,
    siweAuthenticated,
    siweSigningIn,
    siweSignIn,
  } = useWalletApp();

  const guest = !wallet;
  const openConnect = () => setShowModal(true);

  const handleSiweSignIn = async () => {
    const result = await siweSignIn();
    if (result.ok) setToast({ msg: "Signed in successfully", hash: "" });
    else if (result.error && !/cancel/i.test(result.error)) {
      setToast({ msg: result.error, hash: "" });
    }
    return result.ok;
  };

  return (
    <main className="relative min-h-screen font-sans text-[var(--ink)]">
      <AppBackground />
      <div className="relative z-10">
        <AppHeader
          tab={tab}
          onTabChange={setTab}
          guest={guest}
          onConnect={openConnect}
          onDisconnect={handleDisconnect}
          walletAddress={wallet?.address}
          siweAuthenticated={siweAuthenticated}
          siweSigningIn={siweSigningIn}
          onSiweSignIn={() => void handleSiweSignIn()}
        />
        <div className="app-container py-6 sm:py-8">
          <Link
            href="/explore"
            className="mb-6 inline-block text-sm font-semibold text-[var(--brand-dark)] hover:text-[var(--brand)]"
          >
            ← All tokens
          </Link>
          <CreatorProfilePanel
            address={address}
            connectedAddress={wallet?.address ?? null}
            onConnect={openConnect}
            siweAuthenticated={siweAuthenticated}
            siweSigningIn={siweSigningIn}
            onSiweSignIn={() => void handleSiweSignIn()}
          />
        </div>
      </div>

      <ConnectWalletModal
        open={showModal}
        loading={loading}
        onClose={() => setShowModal(false)}
        onConnect={handleConnect}
      />
      {toast && (
        <ToastNotification msg={toast.msg} hash={toast.hash} onClose={() => setToast(null)} />
      )}
    </main>
  );
}
