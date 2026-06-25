import { RefreshCcw, Zap } from "lucide-react";
import { basescanTxUrl } from "@/lib/utils/tx";

interface PremiumBannerProps {
  premiumUnlocked: boolean;
  premiumLoading: boolean;
  premiumData: { message: string; transaction?: string } | null;
  x402PayCount: number;
  onPay: () => void;
}

export default function PremiumBanner({
  premiumUnlocked,
  premiumLoading,
  premiumData,
  x402PayCount,
  onPay,
}: PremiumBannerProps) {
  return (
    <div
      className={`mb-4 rounded-3xl border overflow-hidden transition-all ${
        premiumUnlocked
          ? "bg-amber-950/20 border-yellow-500/30"
          : "bg-[#0d1628] border-blue-500/20"
      }`}
    >
      <div
        className={`h-0.5 ${
          premiumUnlocked
            ? "bg-linear-to-r from-yellow-500 via-amber-400 to-yellow-500"
            : "bg-linear-to-r from-blue-600 to-blue-500"
        }`}
      />
      <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              premiumUnlocked
                ? "bg-yellow-500/15 border-yellow-500/25"
                : "bg-blue-600/15 border-blue-500/25"
            }`}
          >
            <Zap
              size={18}
              className={premiumUnlocked ? "text-yellow-400" : "text-blue-400"}
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-black text-white text-sm">x402 Payment</p>
              <span className="text-[9px] font-black text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                HTTP 402 · Base
              </span>
              {x402PayCount > 0 && (
                <span className="text-[9px] font-black text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                  {x402PayCount} payment{x402PayCount > 1 ? "s" : ""} made
                </span>
              )}
            </div>
            {premiumData?.transaction && (() => {
              const url = basescanTxUrl(premiumData.transaction);
              return url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-yellow-400/80 hover:text-yellow-300 underline mt-1 inline-block"
                >
                  View settlement on Basescan ↗
                </a>
              ) : null;
            })()}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onPay}
            disabled={premiumLoading}
            className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black text-xs px-5 py-3 rounded-2xl transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-yellow-500/20 whitespace-nowrap"
          >
            {premiumLoading ? (
              <>
                <RefreshCcw size={13} className="animate-spin" />
                Signing...
              </>
            ) : (
              <>
                <Zap size={13} />
                Pay 0.005 USDC
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
