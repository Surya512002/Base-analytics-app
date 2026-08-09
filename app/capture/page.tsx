"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import AppHeader from "@/components/wallet/AppHeader";
import ConnectScreen from "@/components/wallet/ConnectScreen";
import AppFeatureStrip from "@/components/wallet/AppFeatureStrip";
import TabBar from "@/components/wallet/TabBar";
import { createMockAppState } from "@/lib/marketing/mock-app-state";
import type { AppTab } from "@/hooks/useWalletApp";

const DashboardTab = dynamic(
  () => import("@/components/wallet/tabs/DashboardTab"),
  { ssr: false }
);
const BaseVoucherTab = dynamic(
  () => import("@/components/wallet/tabs/BaseVoucherTab"),
  { ssr: false }
);

function CaptureContent() {
  const params = useSearchParams();
  const screen = params.get("screen") || "connect";

  if (screen === "connect") {
    return (
      <ConnectScreen
        loading={false}
        scanProgress=""
        showModal={false}
        onOpenModal={() => {}}
        onCloseModal={() => {}}
        onConnect={() => {}}
      />
    );
  }

  const tab: AppTab = screen === "voucher" ? "basehub" : "dashboard";
  const app = createMockAppState(tab);

  return (
    <main className="min-h-screen text-[var(--foreground)] font-sans relative">
      <AppHeader
        tab={tab}
        onTabChange={() => {}}
        walletAddress={app.wallet?.address}
        onDisconnect={() => {}}
      />
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 pb-24">
        <TabBar tab={tab} doneQuests={app.doneQuests} onTabChange={() => {}} />
        <AppFeatureStrip />
        {tab === "dashboard" && <DashboardTab app={app} />}
        {tab === "basehub" && <BaseVoucherTab app={app} />}
      </div>
    </main>
  );
}

/** Marketing capture — /capture?screen=connect|dashboard|voucher */
export default function CapturePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#071220] flex items-center justify-center text-slate-500">
          Loading…
        </div>
      }
    >
      <CaptureContent />
    </Suspense>
  );
}
