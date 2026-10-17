"use client";

import React, { useMemo } from "react";
import VoucherHeader from "@/components/voucher/VoucherHeader";
import VoucherSegmentTabs from "@/components/voucher/VoucherSegmentTabs";
import VoucherCreateWizard from "@/components/voucher/VoucherCreateWizard";
import VoucherRedeemPanel from "@/components/voucher/panels/VoucherRedeemPanel";
import VoucherMyCards from "@/components/voucher/VoucherMyCards";
import VoucherHowItWorks from "@/components/voucher/VoucherHowItWorks";
import VoucherShareSuccessModal from "@/components/voucher/VoucherShareSuccessModal";
import VoucherRedeemReveal from "@/components/wallet/VoucherRedeemReveal";
import { useVoucherTab } from "@/hooks/useVoucherTab";
import { useTokenHoldings } from "@/hooks/useTokenHoldings";
import { BASE_STOCKS } from "@/lib/stocks/base-stocks";
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

  // Prepare tokens list for real-time stock and vault balances
  const voucherTokens = useMemo(() => {
    const stockTokens = BASE_STOCKS.map((s) => ({
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. Compact Header: Title "Gift on Base", 1-line description, 3 small stats */}
      <VoucherHeader />

      {/* 2. Segmented Tabs directly under header: Create | Redeem | My Cards */}
      <VoucherSegmentTabs view={view} onChange={setView} />

      {/* 3. Tab Contents */}
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

      {view === "mine" && (
        <VoucherMyCards
          shared={shared}
          mine={mine}
          onCreateFirstGift={() => setView("create")}
        />
      )}

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
