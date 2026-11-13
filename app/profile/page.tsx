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
import PageHero from "@/components/ui/PageHero";
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
            <div className="mx-auto max-w-3xl">
              <PageHero
                eyebrow={totalUsersFormatted !== "0" ? `Creator profile · ${totalUsersFormatted} users on Base` : "Creator profile"}
                title={
                  <>
                    Your creator profile —{" "}
                    <span className="text-[var(--brand-text)]">one page, every launch.</span>
                  </>
                }
                subtitle={
                  <>
                    B20 launches earn <strong className="text-[var(--ink)]">{shares.creator}</strong> of every{" "}
                    {formatPlatformFeeLabel()} swap fee — paid instantly on each trade.
                  </>
                }
                actions={[{ label: "Connect wallet", onClick: () => setShowModal(true), primary: true }]}
              />
              <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { title: "Connect", note: "Use any Base wallet." },
                  { title: "Sign in", note: "One free signature — no gas." },
                  { title: "Share", note: "Your public page tracks launches and revenue." },
                ].map((step, i) => (
                  <li
                    key={step.title}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 text-left shadow-sm"
                  >
                    <span className="inline-flex rounded-full border border-[var(--brand)]/40 bg-[var(--brand-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--brand-text)]">
                      Step {i + 1}
                    </span>
                    <p className="mt-3 text-base font-bold text-[var(--ink)]">{step.title}</p>
                    <p className="mt-1 text-sm text-[var(--ink-muted)]">{step.note}</p>
                  </li>
                ))}
              </ol>
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
