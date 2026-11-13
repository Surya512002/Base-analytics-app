"use client";

import React, { useEffect, useMemo, useRef } from "react";
import VoucherCampaignPanel from "@/components/voucher/VoucherCampaignPanel";
import { parseCampaignLink } from "@/lib/voucher/campaign";
import { AnimatePresence, motion } from "motion/react";
import VoucherGiftHero from "@/components/voucher/VoucherGiftHero";
import VoucherSegmentTabs from "@/components/voucher/VoucherSegmentTabs";
import VoucherCreateWizard from "@/components/voucher/VoucherCreateWizard";
import VoucherRedeemPanel from "@/components/voucher/panels/VoucherRedeemPanel";
import VoucherMyCards from "@/components/voucher/VoucherMyCards";
import VoucherHowItWorks from "@/components/voucher/VoucherHowItWorks";
import VoucherShareSuccessModal from "@/components/voucher/VoucherShareSuccessModal";
import VoucherRedeemReveal from "@/components/wallet/VoucherRedeemReveal";
import { useVoucherTab } from "@/hooks/useVoucherTab";
import { useTokenHoldings } from "@/hooks/useTokenHoldings";
import { BASE_VERIFIED_STOCKS } from "@/lib/stocks/base-verified";
import { YIELD_VAULT_SHARES } from "@/lib/utils/voucher";
import type { WalletAppState } from "@/hooks/useWalletApp";

export default function BaseVoucherTab({ app }: { app: WalletAppState }) {
  const { shared, create, redeem, mine, modals } = useVoucherTab(app);
  const { view, setView } = shared;
  const {
    cardsReadyGate,
    setCardsReadyGate,
    redeemSuccess,
    setRedeemSuccess,
    setDebouncedRedeemCardId,
    setRedeemPreview,
    redeemPreviewRef,
    setRedeemKey,
    setTab,
  } = modals;
  const { setExpandedBatchId } = mine;
  const { setRedeemCardId, setRedeemSecret } = redeem;

  // Shared-link campaign URLs (…#camp=12&k=SECRET) open the one-link claim view.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const parsed = parseCampaignLink({
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    });
    if (parsed.campaignId || sp.get("view") === "campaign") setView("campaign");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prepare tokens list for real-time stock and vault balances
  const voucherTokens = useMemo(() => {
    const stockTokens = BASE_VERIFIED_STOCKS.map((s) => ({
      address: s.address,
      decimals: s.decimals,
    }));
    const vaultTokens = YIELD_VAULT_SHARES.map((v) => ({
      address: v.address,
      decimals: v.decimals,
    }));
    return [...stockTokens, ...vaultTokens];
  }, []);

  const userBalances = useTokenHoldings(app.wallet?.address, voucherTokens);
  const tabsRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. Hero: animated gift box + one headline + three clear actions */}
      <VoucherGiftHero
        view={view}
        onNavigate={(v) => {
          setView(v);
          tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      {/* 2. Segmented tabs: Create | Claim | One link | My gifts */}
      <div ref={tabsRef} className="scroll-mt-20">
        <VoucherSegmentTabs view={view} onChange={setView} />
      </div>

      {/* 3. Tab contents — cross-fade between views (logic untouched) */}
      <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
      {view === "create" && (
        <VoucherCreateWizard
          shared={shared}
          create={create}
          userBalances={userBalances}
          ethBalance={app.walletCore?.balance ?? "0.00"}
          usdcBalance={app.walletCore?.usdcBalance ?? "0.00"}
        />
      )}

      {view === "redeem" && (
        <VoucherRedeemPanel
          shared={shared}
          redeem={redeem}
          onNavigateTab={(tab) => setTab(tab as any)}
        />
      )}

      {view === "campaign" && <VoucherCampaignPanel app={app} />}

      {view === "mine" && (
        <VoucherMyCards
          shared={shared}
          mine={mine}
          onCreateFirstGift={() => setView("create")}
        />
      )}
      </motion.div>
      </AnimatePresence>

      {/* 4. Collapsible "How it works" (3 steps + FAQ) placed at bottom */}
      <VoucherHowItWorks />

      {/* 5. Success Screen & Share Modal (Secret in fragment #, CSV export, QR code, confirmation guard) */}
      <VoucherShareSuccessModal
        batch={cardsReadyGate}
        onClose={() => {
          if (cardsReadyGate) {
            setView("mine");
            setExpandedBatchId(cardsReadyGate.batchId);
          }
          setCardsReadyGate(null);
        }}
      />

      {/* 6. Redeem Reveal with "View in wallet" and "Swap this" shortcuts */}
      <VoucherRedeemReveal
        key={redeemSuccess?.cardId ?? "closed"}
        data={redeemSuccess}
        onViewWallet={() => {
          setTab("profile");
        }}
        onSwapAsset={() => {
          setTab("swap");
        }}
        onCreateOwn={() => {
          setView("create");
          setTab("basehub");
        }}
        onClose={() => {
          setRedeemSuccess(null);
          setRedeemCardId("");
          setDebouncedRedeemCardId("");
          setRedeemSecret("");
          setRedeemPreview(null);
          redeemPreviewRef.current = null;
          setRedeemKey((k) => k + 1);
        }}
      />
    </div>
  );
}
