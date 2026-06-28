"use client";

import dynamic from "next/dynamic";
import AppBackground from "@/components/ui/AppBackground";
import AppHeader from "@/components/wallet/AppHeader";
import ConnectScreen from "@/components/wallet/ConnectScreen";
import LoadingScreen from "@/components/wallet/LoadingScreen";
import AppFeatureStrip from "@/components/wallet/AppFeatureStrip";
import PremiumBanner from "@/components/wallet/PremiumBanner";
import TabBar from "@/components/wallet/TabBar";
import ToastNotification from "@/components/wallet/ToastNotification";
import { useWalletApp } from "@/hooks/useWalletApp";

const DashboardTab = dynamic(
  () => import("@/components/wallet/tabs/DashboardTab"),
  { loading: () => <TabSkeleton /> }
);
const AchievementsTab = dynamic(
  () => import("@/components/wallet/tabs/AchievementsTab"),
  { loading: () => <TabSkeleton /> }
);
const QuestsTab = dynamic(
  () => import("@/components/wallet/tabs/QuestsTab"),
  { loading: () => <TabSkeleton /> }
);
const LeaderboardTab = dynamic(
  () => import("@/components/wallet/tabs/LeaderboardTab"),
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

export default function Page() {
  const app = useWalletApp();
  const {
    wallet,
    ready,
    loading,
    scanProgress,
    walletRefreshing,
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
    premiumUnlocked,
    premiumLoading,
    premiumData,
    x402PayCount,
    handlePremiumScan,
    doneQuests,
  } = app;

  if (!ready) return <LoadingScreen />;

  if (!wallet) {
    return (
      <ConnectScreen
        loading={loading}
        scanProgress={scanProgress}
        showModal={showModal}
        onOpenModal={() => setShowModal(true)}
        onCloseModal={() => setShowModal(false)}
        onConnect={handleConnect}
      />
    );
  }

  return (
    <main className="min-h-screen text-white font-sans relative">
      <AppBackground />

      {toast && (
        <ToastNotification
          msg={toast.msg}
          hash={toast.hash}
          onClose={() => setToast(null)}
        />
      )}

      <AppHeader
        weeklyXP={weeklyXP}
        sponsored={sponsored}
        walletRefreshing={walletRefreshing}
        onDisconnect={handleDisconnect}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 pt-4 pb-24">
        <TabBar tab={tab} doneQuests={doneQuests} onTabChange={setTab} />

        <PremiumBanner
          premiumUnlocked={premiumUnlocked}
          premiumLoading={premiumLoading}
          premiumData={premiumData}
          x402PayCount={x402PayCount}
          onPay={handlePremiumScan}
        />

        <AppFeatureStrip />

        {tab === "dashboard" && <DashboardTab app={app} />}
        {tab === "achievements" && <AchievementsTab app={app} />}
        {tab === "quests" && <QuestsTab app={app} />}
        {tab === "leaderboard" && <LeaderboardTab app={app} />}
        {tab === "basehub" && <BaseVoucherTab app={app} />}
      </div>
    </main>
  );
}
