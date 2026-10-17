import type { VoucherAsset } from "@/lib/utils/voucher";
import {
  formatVoucherAmount,
  isStockAsset,
  isVaultShareAsset,
  getVaultShareBySymbol,
} from "@/lib/utils/voucher";
import { getBaseStockBySymbol } from "@/lib/stocks/base-stocks";
import AppLogo from "@/components/ui/AppLogo";
import { Sparkles, TrendingUp } from "lucide-react";

function BaseNetworkBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const dim = size === "md" ? "w-5 h-5" : "w-4 h-4";
  return (
    <div className={`${dim} rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0`}>
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
  /** Subtle idle float animation */
  animated?: boolean;
}

export default function VoucherGiftCard3D({
  asset = "USDC",
  amount,
  message,
  status = "active",
  compact = false,
  label,
  showStack = true,
  flat = false,
  animated = false,
}: VoucherGiftCard3DProps) {
  const isVault = isVaultShareAsset(asset);
  const isStock = isStockAsset(asset);
  const stockInfo = !isVault && isStock ? getBaseStockBySymbol(asset) : null;
  const vaultInfo = isVault ? getVaultShareBySymbol(asset) : null;

  const cardLabel =
    label ||
    (isVault
      ? "Yield-Bearing Stock Vault"
      : isStock
        ? "Tokenized Stock Share"
        : "Base Voucher");

  const displayAmount = amount
    ? formatVoucherAmount(asset, amount)
    : asset === "ETH"
      ? "2.5 ETH"
      : isVault
        ? `1.0 ${asset} Vault Share`
        : isStock
          ? `1.0 ${asset} Share`
          : "$10 USDC";

  const amountMain = isStock
    ? displayAmount.split(" ")[0]
    : displayAmount.replace(" USDC", "").replace(" ETH", "");
  const amountUnit = isVault
    ? `${asset} · ${vaultInfo?.name ?? "Vault"}`
    : isStock
      ? `${asset} ${stockInfo ? `· ${stockInfo.name}` : ""}`
      : asset;

  const cardGradient = isVault
    ? "linear-gradient(135deg, #1e1b4b 0%, #1e1145 35%, #0f172a 70%, #030712 100%)"
    : isStock
      ? "linear-gradient(135deg, #071f3d 0%, #0a2f5c 35%, #0d2137 70%, #030712 100%)"
      : "linear-gradient(135deg, #0d3d2e 0%, #0a1f1a 35%, #111827 70%, #0f172a 100%)";

  return (
    <div
      className={`relative mx-auto ${compact ? "w-[min(100%,280px)]" : "w-[min(100%,320px)]"}`}
      style={flat ? undefined : { perspective: "1200px" }}
    >
      {showStack && !flat && (
        <>
          <div
            className={`absolute inset-0 rounded-2xl border border-white/5 ${
              isVault
                ? "bg-linear-to-br from-purple-950/80 to-slate-950/90"
                : isStock
                  ? "bg-linear-to-br from-blue-950/80 to-slate-950/90"
                  : "bg-linear-to-br from-emerald-950/80 to-slate-950/90"
            }`}
            style={{ transform: "translate(8px, 8px) rotateY(-5deg) rotateX(3deg)", opacity: 0.35 }}
          />
          <div
            className={`absolute inset-0 rounded-2xl border border-white/8 ${
              isVault
                ? "bg-linear-to-br from-purple-900/50 to-slate-900/80"
                : isStock
                  ? "bg-linear-to-br from-blue-900/50 to-slate-900/80"
                  : "bg-linear-to-br from-emerald-900/50 to-slate-900/80"
            }`}
            style={{ transform: "translate(4px, 4px) rotateY(-3deg) rotateX(1.5deg)", opacity: 0.55 }}
          />
        </>
      )}

      <div
        className={`relative rounded-2xl overflow-hidden border ${
          isVault
            ? "border-purple-400/40"
            : isStock
              ? "border-blue-400/30"
              : "border-white/15"
        } shadow-[0_24px_60px_rgba(0,0,0,0.55)] ${animated && !flat ? "gift-card-idle-3d" : ""}`}
        style={{
          transform: flat ? "none" : animated ? undefined : "rotateY(-8deg) rotateX(6deg)",
          transformStyle: flat ? undefined : "preserve-3d",
          background: cardGradient,
        }}
      >
        <div
          className={`absolute inset-0 ${
            isVault
              ? "bg-[radial-gradient(ellipse_at_20%_0%,rgba(168,85,247,0.35),transparent_55%)]"
              : isStock
                ? "bg-[radial-gradient(ellipse_at_20%_0%,rgba(59,130,246,0.3),transparent_55%)]"
                : "bg-[radial-gradient(ellipse_at_20%_0%,rgba(16,185,129,0.22),transparent_55%)]"
          }`}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_100%,rgba(0,82,255,0.15),transparent_50%)]" />
        <div
          className={`absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent ${
            isVault
              ? "via-purple-400/60"
              : isStock
                ? "via-blue-400/50"
                : "via-emerald-400/40"
          } to-transparent`}
        />

        <div className={`relative ${compact ? "p-4" : "p-5 sm:p-6"}`}>
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <p className="text-[10px] font-bold text-slate-300 tracking-wide">{cardLabel}</p>
              <p className="text-xs font-black text-white/90 mt-0.5">
                {isVault
                  ? `${vaultInfo?.protocol ?? "DeFi"} Vault`
                  : isStock
                    ? "Base Stock Gift Card"
                    : "base-analytics"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <BaseNetworkBadge size="md" />
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/15 shadow-lg flex items-center justify-center">
                <AppLogo size="sm" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">
              {isVault ? "Yield Vault Position" : isStock ? "RWA Equity Share" : "Gift Card"}
            </p>
            {vaultInfo && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <Sparkles size={10} /> +{vaultInfo.apy.toFixed(2)}% APY
              </span>
            )}
          </div>

          <div className="mb-5">
            <p className={`font-black text-white tracking-tight leading-none ${compact ? "text-3xl" : "text-4xl sm:text-[2.75rem]"}`}>
              {amountMain}
              <span className="text-base sm:text-lg text-blue-300 ml-2 font-bold">
                {isStock ? "Share" : ""}
              </span>
            </p>
            <p className="text-xs sm:text-sm text-slate-300 font-semibold mt-1">
              {amountUnit}
            </p>
          </div>

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
                      ? "bg-emerald-400"
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
