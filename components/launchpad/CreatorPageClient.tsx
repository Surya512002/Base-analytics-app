"use client";

import { useUniqueUsers } from "@/hooks/useUniqueUsers";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/wallet/AppHeader";
import ConnectWalletModal from "@/components/wallet/ConnectWalletModal";
import ToastNotification from "@/components/wallet/ToastNotification";
import CreatorProfilePanel from "@/components/launchpad/CreatorProfilePanel";
import AppShell from "@/components/shell/AppShell";
import AccountSettings from "@/components/shell/AccountSettings";
import { AccountTabs } from "@/components/shell/PlaceTabs";
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
    connType,
  } = useWalletApp();
  // Count the visitor's own connected wallet as active today (never the profile being viewed).
  useUniqueUsers(wallet?.address);

  const guest = sessionBootstrapped ? !wallet : false;
  const openConnect = () => setShowModal(true);
  const isOwn = wallet?.address?.toLowerCase() === address.toLowerCase();

  const handleTabChange = (next: AppTab) => {
    if (guest && next !== "launchpad" && next !== "swap" && next !== "lend") {
      openConnect();
      return;
    }
    setTab(next);
    router.push(hrefForAppTab(next));
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
    <main className="relative min-h-screen font-sans text-[var(--ink)] overflow-x-clip">
      <div className="relative z-10 flex min-h-screen w-full min-w-0 flex-col">
        <AppShell
          tab={tab}
          onTabChange={handleTabChange}
          guest={guest}
          onConnect={openConnect}
          walletAddress={wallet?.address}
          header={
            <AppHeader
              tab={tab}
              guest={guest}
              onConnect={openConnect}
              onDisconnect={handleDisconnect}
              walletAddress={wallet?.address}
              siweAuthenticated={siweAuthenticated}
              siweSigningIn={siweSigningIn}
              onSiweSignIn={() => void handleSiweSignIn()}
            />
          }
        >
          <div className="w-full min-w-0 space-y-6">
          {isOwn && <AccountTabs current="creator" creatorHref={`/creator/${address}`} />}
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
              connType={connType}
            />
          )}
          {isOwn && <AccountSettings />}
          </div>
        </AppShell>
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
