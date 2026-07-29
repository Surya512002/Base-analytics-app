"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AppBackground from "@/components/ui/AppBackground";
import AppHeader from "@/components/wallet/AppHeader";
import ConnectWalletModal from "@/components/wallet/ConnectWalletModal";
import ToastNotification from "@/components/wallet/ToastNotification";
import CreatorProfilePanel from "@/components/launchpad/CreatorProfilePanel";
import MobileBottomNav from "@/components/shell/MobileBottomNav";
import { useWalletApp, type AppTab } from "@/hooks/useWalletApp";
import { hrefForAppTab } from "@/lib/utils/wallet-persist";

export default function CreatorPageClient({ address }: { address: string }) {
  const router = useRouter();
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
    sessionBootstrapped,
    siweAuthenticated,
    siweSigningIn,
    siweSignIn,
  } = useWalletApp();

  const guest = sessionBootstrapped ? !wallet : false;
  const openConnect = () => setShowModal(true);

  const handleTabChange = (next: AppTab) => {
    if (guest && next !== "launchpad" && next !== "swap") {
      openConnect();
      return;
    }
    const resolved = next === "rewards" ? "checkin" : next;
    setTab(resolved);
    router.push(hrefForAppTab(resolved));
  };

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
          onTabChange={handleTabChange}
          guest={guest}
          onConnect={openConnect}
          onDisconnect={handleDisconnect}
          walletAddress={wallet?.address}
          siweAuthenticated={siweAuthenticated}
          siweSigningIn={siweSigningIn}
          onSiweSignIn={() => void handleSiweSignIn()}
        />
        <div className="app-container py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:py-8 lg:pb-8">
          <Link
            href="/explore"
            className="mb-6 inline-block text-sm font-semibold text-[var(--brand-dark)] hover:text-[var(--brand)]"
          >
            ← All tokens
          </Link>
          {!sessionBootstrapped ? (
            <div className="mx-auto max-w-md text-center">
              <div className="h-12 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
              <p className="mt-4 text-sm text-[var(--ink-muted)]">Restoring session…</p>
            </div>
          ) : (
            <CreatorProfilePanel
              address={address}
              connectedAddress={wallet?.address ?? null}
              onConnect={openConnect}
              siweAuthenticated={siweAuthenticated}
              siweSigningIn={siweSigningIn}
              onSiweSignIn={() => void handleSiweSignIn()}
            />
          )}
        </div>
      </div>

      <MobileBottomNav
        tab={tab}
        onTabChange={handleTabChange}
        guest={guest}
        onConnect={openConnect}
        walletAddress={wallet?.address}
      />

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
