"use client";

import BaseHub from "@/components/BaseHub";
import AppHeader from "@/components/wallet/AppHeader";
import ConnectScreen from "@/components/wallet/ConnectScreen";
import LoadingScreen from "@/components/wallet/LoadingScreen";
import PremiumBanner from "@/components/wallet/PremiumBanner";
import TabBar from "@/components/wallet/TabBar";
import ToastNotification from "@/components/wallet/ToastNotification";
import AchievementsTab from "@/components/wallet/tabs/AchievementsTab";
import DashboardTab from "@/components/wallet/tabs/DashboardTab";
import LeaderboardTab from "@/components/wallet/tabs/LeaderboardTab";
import QuestsTab from "@/components/wallet/tabs/QuestsTab";
import { useWalletApp } from "@/hooks/useWalletApp";

export default function Page() {
  const app = useWalletApp();
  const {
    wallet,
    ready,
    loading,
    scanProgress,
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
    <main className="min-h-screen bg-[#0a0f1e] text-white font-sans">
      <div
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(59,130,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.04) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

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
        onDisconnect={handleDisconnect}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 pb-24">
        <PremiumBanner
          premiumUnlocked={premiumUnlocked}
          premiumLoading={premiumLoading}
          premiumData={premiumData}
          x402PayCount={x402PayCount}
          onPay={handlePremiumScan}
        />

        <TabBar tab={tab} doneQuests={doneQuests} onTabChange={setTab} />

        {tab === "dashboard" && <DashboardTab app={app} />}
        {tab === "achievements" && <AchievementsTab app={app} />}
        {tab === "quests" && <QuestsTab app={app} />}
        {tab === "leaderboard" && <LeaderboardTab app={app} />}
        {tab === "basehub" && <BaseHub />}
      </div>

      <style>{`
        @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        .no-scrollbar::-webkit-scrollbar{display:none}
        .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}
      `}</style>
    </main>
  );
}
