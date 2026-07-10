"use client";

import VoucherLanding from "@/components/voucher/VoucherLanding";
import VoucherWhySection from "@/components/wallet/VoucherWhySection";
import VoucherCardsReadyGate from "@/components/wallet/VoucherCardsReadyGate";
import VoucherRedeemReveal from "@/components/wallet/VoucherRedeemReveal";
import VoucherSegmentTabs from "@/components/voucher/VoucherSegmentTabs";
import VoucherContractBanner from "@/components/voucher/VoucherContractBanner";
import {
  VoucherCreatePanel,
  VoucherRedeemPanel,
  VoucherViewPanel,
  VoucherMinePanel,
} from "@/components/voucher/panels";
import { useVoucherTab } from "@/hooks/useVoucherTab";
import type { WalletAppState } from "@/hooks/useWalletApp";

export default function BaseVoucherTab({ app }: { app: WalletAppState }) {
  const { shared, create, redeem, viewLookup, mine, modals } = useVoucherTab(app);
  const { view, setView, contractReady } = shared;
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

  return (
    <div className="space-y-4 pb-8">
      <VoucherLanding />
      <VoucherContractBanner contractReady={contractReady} />
      <VoucherSegmentTabs view={view} onChange={setView} />

      {view === "create" && <VoucherCreatePanel shared={shared} create={create} />}
      {view === "redeem" && <VoucherRedeemPanel shared={shared} redeem={redeem} />}
      {view === "view" && (
        <VoucherViewPanel shared={shared} viewLookup={viewLookup} redeem={redeem} />
      )}
      {view === "mine" && <VoucherMinePanel shared={shared} mine={mine} />}

      <VoucherWhySection />

      <VoucherCardsReadyGate
        batch={cardsReadyGate}
        onDismiss={() => {
          if (cardsReadyGate) {
            setView("mine");
            setExpandedBatchId(cardsReadyGate.batchId);
          }
          setCardsReadyGate(null);
        }}
      />

      <VoucherRedeemReveal
        key={redeemSuccess?.cardId ?? "closed"}
        data={redeemSuccess}
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
