import type { VoucherAsset } from "@/lib/utils/voucher";
import { formatVoucherAmount } from "@/lib/utils/voucher";
import AppLogo from "@/components/ui/AppLogo";

function BaseNetworkBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const dim = size === "md" ? "w-5 h-5" : "w-4 h-4";
  return (
    <div className={`${dim} rounded-full bg-[#0052FF] flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(0,82,255,0.5)]`}>
      <div className="w-[55%] h-[2px] bg-white rounded-full" />
    </div>
  );
}

interface VoucherGiftCard3DProps {
  asset?: VoucherAsset;
  amount?: bigint;
  message?: string;
  status?: "active" | "redeemed";
  compact?: boolean;
  label?: string;
  showStack?: boolean;
  /** Flat 2D card — avoids 3D jitter in redeem preview */
  flat?: boolean;
}

export default function VoucherGiftCard3D({
  asset = "USDC",
  amount,
  message,
  status = "active",
  compact = false,
  label = "Base Voucher",
  showStack = true,
  flat = false,
}: VoucherGiftCard3DProps) {
  const displayAmount = amount
    ? formatVoucherAmount(asset, amount)
    : asset === "ETH"
      ? "2.5 ETH"
      : "$10 USDC";

  const amountMain = displayAmount.replace(" USDC", "").replace(" ETH", "");
  const amountUnit = asset;

  return (
    <div
      className={`relative mx-auto ${compact ? "w-[min(100%,280px)]" : "w-[min(100%,320px)]"}`}
      style={flat ? undefined : { perspective: "1200px" }}
    >
      {showStack && !flat && (
        <>
          <div
            className="absolute inset-0 rounded-2xl border border-white/5 bg-linear-to-br from-emerald-950/80 to-slate-950/90"
            style={{ transform: "translate(14px, 14px) rotateY(-6deg) rotateX(4deg)", opacity: 0.35 }}
          />
          <div
            className="absolute inset-0 rounded-2xl border border-white/8 bg-linear-to-br from-emerald-900/50 to-slate-900/80"
            style={{ transform: "translate(7px, 7px) rotateY(-4deg) rotateX(2deg)", opacity: 0.55 }}
          />
        </>
      )}

      <div
        className="relative rounded-2xl overflow-hidden border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.55),0_0_40px_rgba(0,82,255,0.15)]"
        style={{
          transform: flat ? "none" : "rotateY(-8deg) rotateX(6deg)",
          transformStyle: flat ? undefined : "preserve-3d",
          background: "linear-gradient(135deg, #0d3d2e 0%, #0a1f1a 35%, #111827 70%, #0f172a 100%)",
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(16,185,129,0.22),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_100%,rgba(0,82,255,0.12),transparent_50%)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-emerald-400/40 to-transparent" />

        <div className={`relative ${compact ? "p-4" : "p-5 sm:p-6"}`}>
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <p className="text-[10px] font-bold text-slate-400 tracking-wide">{label}</p>
              <p className="text-xs font-black text-white/90 mt-0.5">base-analytics</p>
            </div>
            <div className="flex items-center gap-2">
              <BaseNetworkBadge size="md" />
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/15 shadow-lg flex items-center justify-center">
                <AppLogo size="sm" />
              </div>
            </div>
          </div>

          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-1">Gift Card</p>
          <p className={`font-black text-white tracking-tight leading-none ${compact ? "text-3xl" : "text-4xl sm:text-[2.75rem]"}`}>
            {amountMain}
            <span className="text-lg sm:text-xl text-slate-400 ml-2 font-bold">{amountUnit}</span>
          </p>
          <div className="h-0.5 w-16 bg-linear-to-r from-violet-500 via-cyan-400 to-transparent rounded-full mt-3 mb-4" />

          {message?.trim() ? (
            <div className="mb-4 rounded-xl bg-black/25 border border-white/10 px-3 py-2.5">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Message
              </p>
              <p className="text-xs sm:text-sm text-slate-100 italic leading-snug line-clamp-3">
                &quot;{message.trim()}&quot;
              </p>
            </div>
          ) : null}

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase mb-1.5">Network</p>
              <div className="flex items-center gap-2">
                <BaseNetworkBadge />
                <span className="text-sm font-black text-white">Base</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold text-slate-500 uppercase mb-1.5">Status</p>
              <div className="flex items-center justify-end gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    status === "active"
                      ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                      : "bg-slate-500"
                  }`}
                />
                <span
                  className={`text-sm font-black ${
                    status === "active" ? "text-emerald-400" : "text-slate-400"
                  }`}
                >
                  {status === "active" ? "Active" : "Redeemed"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { BaseNetworkBadge };
