"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import AppBackground from "@/components/ui/AppBackground";
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
import type { X402ProductId } from "@/lib/constants/x402-products";

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
  } = app;

  const [launchBridge, setLaunchBridge] = useState<LaunchpadShellBridge | null>(null);
  const guest = !wallet;
  const activeTab = forceTab ?? tab;

  const openConnect = useCallback(() => {
    saveGuestResume(captureGuestResumeFromUrl());
    setShowModal(true);
  }, [setShowModal]);

  const handleTabChange = useCallback(
    (next: AppTab, opts?: { rewardsView?: RewardsHubView }) => {
      if (guest && next !== "launchpad") {
        openConnect();
        return;
      }
      const resolved = next === "rewards" ? "checkin" : next;
      setTab(resolved);
      if (resolved === "checkin") {
        syncRewardsHubUrl(
          opts?.rewardsView ?? (next === "rewards" ? "stake" : "checkin")
        );
      } else {
        syncTabUrl(resolved);
      }
    },
    [guest, openConnect, setTab]
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

  if (!ready) return <LoadingScreen />;

  return (
    <main className="main-app-shell min-h-screen text-white font-sans relative">
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
        wallet={wallet}
        walletCore={walletCore}
        guest={guest}
        onConnect={openConnect}
        onCreateToken={() => launchBridge?.openCreate()}
        onOpenToken={(t) => launchBridge?.openToken(t)}
        tokens={launchBridge?.tokens ?? []}
        header={
          <AppHeader
            weeklyXP={weeklyXP}
            sponsored={sponsored}
            walletRefreshing={walletRefreshing || (analyticsSyncing && activeTab === "dashboard")}
            scanProgress={scanProgress}
            onDisconnect={handleDisconnect}
            guest={guest}
            onConnect={openConnect}
            showCommandPalette
          />
        }
      >
        {guest && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-[var(--bg-raised)] px-3 py-2">
            <p className="text-[12px] text-[var(--ink-dim)]">
              Browsing as guest —{" "}
              <span className="text-[var(--ink-muted)]">connect to trade &amp; launch</span>
            </p>
            <button
              type="button"
              onClick={openConnect}
              className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--ink)] text-[#080808] hover:bg-white transition-colors"
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

        <div className="tab-content-enter">
          {activeTab === "launchpad" && (
            <LaunchpadTab
              app={app}
              guestMode={guest}
              onRequestConnect={openConnect}
              onShellBridge={handleShellBridge}
              initialToken={initialToken}
              onNavigate={handleTabChange}
              onPayAgent={handlePayAgent}
              isActive
            />
          )}
          {!guest && activeTab === "basehub" && <BaseVoucherTab app={app} />}
          {!guest && activeTab === "dashboard" && <DashboardTab app={app} />}
          {!guest && isRewardsHubTab(activeTab) && <RewardsHubTab app={app} />}
          {!guest && activeTab === "achievements" && <AchievementsTab app={app} />}
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
