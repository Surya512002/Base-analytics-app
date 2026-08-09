"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { MotionPage } from "@/components/ui/MotionShell";
import AppHeader from "@/components/wallet/AppHeader";
import ConnectWalletModal from "@/components/wallet/ConnectWalletModal";
import LoadingScreen from "@/components/wallet/LoadingScreen";
import AppFeatureStrip from "@/components/wallet/AppFeatureStrip";
import OnboardingTour from "@/components/wallet/OnboardingTour";
import AppFooterNav from "@/components/wallet/AppFooterNav";
import ToastNotification from "@/components/wallet/ToastNotification";
import AppShell from "@/components/shell/AppShell";
import BaseAppPinBanner from "@/components/shell/BaseAppPinBanner";
import { useWalletApp, type AppTab } from "@/hooks/useWalletApp";
import type { LaunchpadShellBridge } from "@/components/launchpad/LaunchpadTab";
import { syncTabUrl, syncRewardsHubUrl, isRewardsHubTab, type RewardsHubView } from "@/lib/utils/app-url";
import { captureGuestResumeFromUrl, saveGuestResume } from "@/lib/utils/guest-resume";
import { hrefForAppTab } from "@/lib/utils/wallet-persist";
import type { X402ProductId } from "@/lib/constants/x402-products";
import {
  armGuideReplay,
  peekGuideReplay,
  requestOpenGuide,
} from "@/lib/utils/onboarding-tour";

const SwapTab = dynamic(
  () => import("@/components/swap/SwapTab"),
  { loading: () => <TabSkeleton /> }
);
const LaunchpadTab = dynamic(
  () => import("@/components/launchpad/LaunchpadTab"),
  { loading: () => <TabSkeleton /> }
);
const DashboardTab = dynamic(
  () => import("@/components/wallet/tabs/DashboardTab"),
  { loading: () => <TabSkeleton /> }
);
const RewardsHubTab = dynamic(
  () => import("@/components/wallet/tabs/RewardsHubTab"),
  { loading: () => <TabSkeleton /> }
);
const AchievementsTab = dynamic(
  () => import("@/components/wallet/tabs/AchievementsTab"),
  { loading: () => <TabSkeleton /> }
);
const BaseVoucherTab = dynamic(
  () => import("@/components/wallet/tabs/BaseVoucherTab"),
  { loading: () => <TabSkeleton /> }
);

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-32 glass-panel rounded-3xl" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 glass-panel rounded-2xl" />
        <div className="h-24 glass-panel rounded-2xl" />
      </div>
      <div className="h-48 glass-panel rounded-3xl" />
    </div>
  );
}

export type HomeAppProps = {
  initialToken?: string | null;
  forceTab?: AppTab;
};

export default function HomeApp({ initialToken, forceTab }: HomeAppProps) {
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
    handlePremiumScan,
    setX402Product,
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
  const guideReplayHandled = useRef(false);

  useEffect(() => {
    setSiweSkipped(false);
  }, [wallet?.address]);

  // Documents / deep-link replay: ?guide=1 arms the matching tour after shell is ready.
  useEffect(() => {
    if (typeof window === "undefined" || !sessionBootstrapped) return;
    if (guideReplayHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("guide") === "1";
    const armed = peekGuideReplay();
    if (!fromUrl && !armed) return;

    guideReplayHandled.current = true;
    if (fromUrl) {
      const url = new URL(window.location.href);
      url.searchParams.delete("guide");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      if (!armed) armGuideReplay(guest ? "explore" : "main");
    }

    const which = peekGuideReplay() ?? (guest ? "explore" : "main");
    const t = window.setTimeout(() => {
      requestOpenGuide(which);
    }, 250);
    return () => window.clearTimeout(t);
  }, [sessionBootstrapped, guest, walletScanComplete]);

  const openConnect = useCallback(() => {
    saveGuestResume(captureGuestResumeFromUrl());
    setShowModal(true);
  }, [setShowModal]);

  const handleTabChange = useCallback(
    (next: AppTab, opts?: { rewardsView?: RewardsHubView; token?: string | null }) => {
      if (guest && next !== "launchpad" && next !== "swap") {
        openConnect();
        return;
      }
      const resolved = next === "rewards" ? "checkin" : next;
      // /explore and /swap pin forceTab — leave the route when navigating away.
      if (forceTab && resolved !== forceTab) {
        router.push(hrefForAppTab(resolved));
        return;
      }
      setTab(resolved);
      if (resolved === "checkin") {
        syncRewardsHubUrl("checkin");
      } else if (opts?.token) {
        syncTabUrl(resolved, { token: opts.token });
      } else {
        syncTabUrl(resolved);
      }
    },
    [guest, openConnect, setTab, forceTab, router]
  );

  const handleShellBridge = useCallback((bridge: LaunchpadShellBridge) => {
    setLaunchBridge(bridge);
  }, []);

  const handlePayAgent = useCallback(
    (productId: X402ProductId) => {
      setX402Product(productId);
      void handlePremiumScan(productId);
    },
    [handlePremiumScan, setX402Product]
  );

  if (!ready || !sessionBootstrapped) return <LoadingScreen />;

  return (
    <main className="main-app-shell flex min-h-screen min-h-[100dvh] w-full min-w-0 flex-col text-[var(--foreground)] font-sans relative">
      <AnimatePresence mode="wait">
        {toast ? (
          <ToastNotification
            key={`${toast.msg}-${toast.hash}`}
            msg={toast.msg}
            hash={toast.hash}
            onClose={() => setToast(null)}
          />
        ) : null}
      </AnimatePresence>

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
            walletRefreshing={walletRefreshing || (analyticsSyncing && activeTab === "dashboard")}
            scanProgress={scanProgress}
            onDisconnect={handleDisconnect}
            guest={guest}
            onConnect={openConnect}
            siweAuthenticated={siweAuthenticated}
            siweSigningIn={siweSigningIn}
            siweSessionChecked={siweSessionChecked}
            onSiweSignIn={() => void handleSiweSignIn()}
            siwePromptDismissed={siweSkipped}
            onSiweSkip={() => setSiweSkipped(true)}
          />
        }
      >
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
            <AppFeatureStrip onNavigate={handleTabChange} />
          </>
        )}

        <div className="w-full min-w-0 relative">
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === "launchpad" && (
              <MotionPage key="tab-launchpad" pageKey="launchpad" className="w-full min-w-0">
                <LaunchpadTab
                  app={app}
                  guestMode={guest}
                  onRequestConnect={openConnect}
                  onShellBridge={handleShellBridge}
                  onNavigate={handleTabChange}
                  onPayAgent={handlePayAgent}
                  isActive
                />
              </MotionPage>
            )}
            {activeTab === "swap" && (
              <MotionPage key="tab-swap" pageKey="swap" className="w-full min-w-0">
                <SwapTab
                  app={app}
                  guestMode={guest}
                  onRequestConnect={openConnect}
                  initialToken={initialToken}
                />
              </MotionPage>
            )}
            {!guest && activeTab === "basehub" && (
              <MotionPage key="tab-basehub" pageKey="basehub" className="w-full min-w-0">
                <BaseVoucherTab app={app} />
              </MotionPage>
            )}
            {!guest && activeTab === "dashboard" && (
              <MotionPage key="tab-dashboard" pageKey="dashboard" className="w-full min-w-0">
                <DashboardTab app={app} />
              </MotionPage>
            )}
            {!guest && isRewardsHubTab(activeTab) && (
              <MotionPage key="tab-rewards" pageKey="rewards" className="w-full min-w-0">
                <RewardsHubTab app={app} />
              </MotionPage>
            )}
            {!guest && activeTab === "achievements" && (
              <MotionPage key="tab-achievements" pageKey="achievements" className="w-full min-w-0">
                <AchievementsTab app={app} />
              </MotionPage>
            )}
          </AnimatePresence>
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
