"use client";

import { AlertCircle, CheckCircle, RefreshCcw, Search } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import VoucherCardPreview from "@/components/voucher/VoucherCardPreview";
import type { useVoucherTab } from "@/hooks/useVoucherTab";

type VoucherTab = ReturnType<typeof useVoucherTab>;

export default function VoucherViewPanel({
  shared,
  viewLookup,
  redeem,
}: {
  shared: VoucherTab["shared"];
  viewLookup: VoucherTab["viewLookup"];
  redeem: Pick<VoucherTab["redeem"], "setRedeemCardId" | "setRedeemSecret">;
}) {
  const { contractReady, setView } = shared;
  const { setRedeemCardId, setRedeemSecret } = redeem;
  const {
    viewCardId,
    setViewCardId,
    viewSecret,
    setViewSecret,
    viewLoading,
    viewError,
    viewedCard,
    lookupCard,
  } = viewLookup;

  const goToRedeem = () => {
    if (!viewedCard) return;
    shared.setView("redeem");
    // Parent hook exposes setters via redeem group — passed through shared for navigation
  };

  return (
    <SectionCard>
      <div className="space-y-4">
        <div className="page-hero">
          <p className="section-eyebrow flex items-center gap-2">
            <Search size={12} /> View voucher by Card ID
          </p>
          <p className="readable-body mt-2">
            Look up what&apos;s inside a Base Voucher onchain. Add the secret to verify the card key matches.
          </p>
        </div>

        <div>
          <label className="section-eyebrow">Card ID</label>
          <input
            value={viewCardId}
            onChange={(e) => setViewCardId(e.target.value)}
            placeholder="e.g. 12-3"
            className="w-full mt-1 input-ink rounded-xl px-3 py-3 text-white font-mono outline-none focus:border-white/25"
          />
        </div>
        <div>
          <label className="section-eyebrow">Secret (optional — verify key)</label>
          <input
            value={viewSecret}
            onChange={(e) => setViewSecret(e.target.value.toUpperCase())}
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
            className="w-full mt-1 input-ink rounded-xl px-3 py-3 text-white font-mono tracking-wider outline-none focus:border-white/25"
          />
        </div>

        {viewError && <p className="text-red-400 text-xs font-bold">{viewError}</p>}

        <button
          type="button"
          onClick={lookupCard}
          disabled={!contractReady || viewLoading || !viewCardId.trim()}
          className="w-full py-3.5 rounded-xl font-black btn-primary disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {viewLoading ? (
            <>
              <RefreshCcw size={16} className="animate-spin" /> Loading…
            </>
          ) : (
            <>
              <Search size={16} /> View Card
            </>
          )}
        </button>

        {viewedCard && (
          <div className="space-y-4 pt-2">
            <VoucherCardPreview
              cardId={viewedCard.cardId}
              secret={viewSecret.trim() || undefined}
              asset={viewedCard.asset}
              amount={viewedCard.amountPerCard}
              message={viewedCard.message}
              redeemed={viewedCard.redeemed}
              showSecret={Boolean(viewSecret.trim())}
            />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="glass-panel-accent rounded-xl p-3">
                <p className="text-[9px] font-bold text-slate-500 uppercase">Batch</p>
                <p className="font-black text-white mt-0.5">#{viewedCard.batchId}</p>
              </div>
              <div className="glass-panel-accent rounded-xl p-3">
                <p className="text-[9px] font-bold text-slate-500 uppercase">Redeemed</p>
                <p className="font-black text-cyan-400 mt-0.5">
                  {viewedCard.redeemedCount}/{viewedCard.cardCount}
                </p>
              </div>
              <div className="glass-panel-accent rounded-xl p-3 col-span-2">
                <p className="text-[9px] font-bold text-slate-500 uppercase">Creator</p>
                <p className="font-mono text-white mt-0.5 text-[11px] truncate">{viewedCard.creator}</p>
              </div>
            </div>
            {viewedCard.redeemed && (
              <p className="text-amber-300 text-xs font-bold flex items-center gap-1.5">
                <AlertCircle size={14} /> This card has already been redeemed onchain.
              </p>
            )}
            {viewedCard.secretValid === true && (
              <p className="text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle size={14} /> Secret verified — this key matches the card onchain.
              </p>
            )}
            {viewedCard.secretValid === false && (
              <p className="text-red-400 text-xs font-bold flex items-center gap-1.5">
                <AlertCircle size={14} /> Secret does not match this card.
              </p>
            )}
            {!viewedCard.redeemed && (
              <button
                type="button"
                onClick={() => {
                  setRedeemCardId(viewedCard.cardId);
                  setRedeemSecret(viewSecret);
                  setView("redeem");
                }}
                className="w-full py-3 rounded-xl font-black bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25"
              >
                Go to Redeem →
              </button>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
