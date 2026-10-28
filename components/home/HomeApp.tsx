"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import AppBackground from "@/components/ui/AppBackground";
import AppHeader from "@/components/wallet/AppHeader";
import ConnectWalletModal from "@/components/wallet/ConnectWalletModal";
import LoadingScreen from "@/components/wallet/LoadingScreen";
import AppFeatureStrip from "@/components/wallet/AppFeatureStrip";
import OnboardingTour from "@/components/wallet/OnboardingTour";
import AppFooterNav from "@/components/wallet/AppFooterNav";
import ToastNotification from "@/components/wallet/ToastNotification";
import SignInOverlay from "@/components/wallet/SignInOverlay";
import AppShell from "@/components/shell/AppShell";
import BaseAppPinBanner from "@/components/shell/BaseAppPinBanner";
import { useWalletApp, type AppTab } from "@/hooks/useWalletApp";
import type { LaunchpadShellBridge } from "@/components/launchpad/LaunchpadTab";
import { syncTabUrl } from "@/lib/utils/app-url";
import { captureGuestResumeFromUrl, saveGuestResume } from "@/lib/utils/guest-resume";
import { hrefForAppTab } from "@/lib/utils/wallet-persist";

const SwapTab = dynamic(
  () => import("@/components/swap/SwapTab"),
  { loading: () => <TabSkeleton /> }
);
const LaunchpadTab = dynamic(
  () => import("@/components/launchpad/LaunchpadTab"),
  { loading: () => <TabSkeleton /> }
);
const BaseVoucherTab = dynamic(
  () => import("@/components/wallet/tabs/BaseVoucherTab"),
  { loading: () => <TabSkeleton /> }
);
const LendingHub = dynamic(
  () => import("@/components/lending/LendingHub"),
  { loading: () => <TabSkeleton /> }
);

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-meridian-fade">
      <div className="h-32 skeleton-shimmer rounded-2xl border border-[var(--border-subtle)]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 skeleton-shimmer rounded-xl border border-[var(--border-subtle)]" />
        <div className="h-24 skeleton-shimmer rounded-xl border border-[var(--border-subtle)]" />
      </div>
      <div className="h-48 skeleton-shimmer rounded-2xl border border-[var(--border-subtle)]" />
    </div>
  );
}

export type HomeAppProps = {
  initialToken?: string | null;
  forceTab?: AppTab;
  initialLaunchView?: "explore" | "create" | "trade";
};

export default function HomeApp({ initialToken, forceTab, initialLaunchView }: HomeAppProps) {
  const router = useRouter();
  const app = useWalletApp();
  const {
    wallet,
    walletCore,
    ready,
    loading,
    scanProgress,
    walletRefreshing,
    analyticsSyncing,
    showModal,
    setShowModal,
    handleConnect,
    tab,
    setTab,
    toast,
    setToast,
    weeklyXP,
    sponsored,
    handleDisconnect,
    walletScanComplete,
    sessionBootstrapped,
    siweAuthenticated,
    siweSessionChecked,
    siweSigningIn,
    siweSignIn,
  } = app;

  const handleSiweSignIn = useCallback(async () => {
    const result = await siweSignIn();
    if (result.ok) {
      setToast({ msg: "Signed in — creator profile & revenue tools unlocked", hash: "" });
    } else if (result.error && !/cancel/i.test(result.error)) {
      setToast({ msg: result.error, hash: "" });
    }
  }, [siweSignIn, setToast]);

  const [siweSkipped, setSiweSkipped] = useState(false);
  const [launchBridge, setLaunchBridge] = useState<LaunchpadShellBridge | null>(null);
  const guest = sessionBootstrapped ? !wallet : false;
  const activeTab = forceTab ?? tab;

  useEffect(() => {
    setSiweSkipped(false);
  }, [wallet?.address]);

  const openConnect = useCallback(() => {
    saveGuestResume(captureGuestResumeFromUrl());
    setShowModal(true);
  }, [setShowModal]);

  const handleTabChange = useCallback(
    (
      next: AppTab,
      opts?: { token?: string | null; buy?: string | null; sell?: string | null; amount?: string | number | null }
    ) => {
      if (guest && next !== "launchpad" && next !== "swap" && next !== "lend") {
        openConnect();
        return;
      }
      if (forceTab && next !== forceTab) {
        router.push(hrefForAppTab(next, opts));
        return;
      }
      setTab(next);
      if (opts?.buy || opts?.token || opts?.sell || opts?.amount) {
        syncTabUrl(next, opts);
      } else {
        syncTabUrl(next);
      }
    },
    [guest, openConnect, setTab, forceTab, router]
  );


  const handleShellBridge = useCallback((bridge: LaunchpadShellBridge) => {
    setLaunchBridge(bridge);
  }, []);

  if (!ready || !sessionBootstrapped) return <LoadingScreen />;

  return (
    <main className="main-app-shell flex min-h-screen min-h-[100dvh] w-full min-w-0 flex-col text-[var(--foreground)] font-sans relative">
      <AppBackground />

      {toast && (
        <ToastNotification
          msg={toast.msg}
          hash={toast.hash}
          onClose={() => setToast(null)}
        />
      )}

      <AppShell
        tab={activeTab}
        onTabChange={handleTabChange}
        guest={guest}
        onConnect={openConnect}
        onOpenToken={(t) => launchBridge?.openToken(t)}
        tokens={launchBridge?.tokens ?? []}
        walletAddress={wallet?.address}
        header={
          <AppHeader
            tab={activeTab}
            onTabChange={handleTabChange}
            walletAddress={wallet?.address}
            walletRefreshing={walletRefreshing}
            scanProgress={scanProgress}
            onDisconnect={handleDisconnect}
            guest={guest}
            onConnect={openConnect}
            siweAuthenticated={siweAuthenticated}
            siweSigningIn={siweSigningIn}
            onSiweSignIn={() => void handleSiweSignIn()}
          />
        }
      >
        <SignInOverlay
          visible={
            !guest &&
            !!wallet?.address &&
            siweSessionChecked &&
            !siweAuthenticated &&
            !siweSkipped
          }
          signingIn={siweSigningIn}
          onSignIn={() => void handleSiweSignIn()}
          onSkip={() => setSiweSkipped(true)}
        />

        {guest && (
          <div className="mb-4 flex flex-col gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <p className="min-w-0 text-[12px] text-[var(--ink-muted)]">
              Browsing as guest —{" "}
              <span className="text-[var(--ink-soft)]">connect to trade &amp; launch</span>
            </p>
            <button
              type="button"
              onClick={openConnect}
              className="btn-primary shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
            >
              Connect
            </button>
          </div>
        )}

        <BaseAppPinBanner
          walletAddress={wallet?.address}
          onToast={(msg) => setToast({ msg, hash: "" })}
        />

        {!guest && (
          <>
            <OnboardingTour onNavigate={handleTabChange} ready={walletScanComplete} />
            {activeTab !== "swap" && activeTab !== "basehub" && activeTab !== "launchpad" && (
              <AppFeatureStrip onNavigate={handleTabChange} />
            )}
          </>
        )}

        <div className="tab-content-enter w-full min-w-0">
          {activeTab === "launchpad" && (
            <LaunchpadTab
              app={app}
              guestMode={guest}
              onRequestConnect={openConnect}
              onShellBridge={handleShellBridge}
              onNavigate={handleTabChange}
              initialView={initialLaunchView}
              isActive
            />
          )}
          {activeTab === "swap" && (
            <SwapTab
              app={app}
              guestMode={guest}
              onRequestConnect={openConnect}
              initialToken={initialToken}
            />
          )}
          {activeTab === "lend" && (
            <LendingHub
              app={app}
              guestMode={guest}
              onRequestConnect={openConnect}
            />
          )}
          {!guest && activeTab === "basehub" && <BaseVoucherTab app={app} />}
        </div>

        <AppFooterNav />
      </AppShell>

      <ConnectWalletModal
        open={showModal}
        loading={loading}
        onClose={() => setShowModal(false)}
        onConnect={handleConnect}
      />
    </main>
  );
}
