import {
  LAUNCHPAD_PLATFORM_FEE_BPS,
  formatPlatformFeeLabel,
} from "@/lib/constants/launchpad";
import { splitPlatformFee, feeShareLabels } from "@/lib/launchpad/fee-split";

export function computePlatformFee(
  amount: bigint,
  bps = LAUNCHPAD_PLATFORM_FEE_BPS
): bigint {
  if (bps <= 0 || amount <= BigInt(0)) return BigInt(0);
  return (amount * BigInt(bps)) / BigInt(10000);
}

export function splitGrossAmount(
  gross: bigint,
  bps = LAUNCHPAD_PLATFORM_FEE_BPS
): { net: bigint; fee: bigint } {
  const fee = computePlatformFee(gross, bps);
  return { net: gross - fee, fee };
}

export function formatFeeFromGross(
  grossAmount: string,
  direction: "buy" | "sell",
  decimals: number,
  opts?: {
    creator?: `0x${string}`;
    referrer?: `0x${string}` | null;
  }
): {
  platformFeeLabel: string;
  platformFeeDisplay: string;
  swapAmountDisplay: string;
  grossDisplay: string;
  creatorShareDisplay?: string;
  platformShareDisplay?: string;
  referrerShareDisplay?: string;
} {
  const dec = direction === "buy" ? 18 : decimals;
  const gross = BigInt(grossAmount);
  const { net, fee } = splitGrossAmount(gross);
  const unit = direction === "buy" ? "ETH" : "tokens";
  const fmt = (v: bigint) => {
    const n = Number(v) / 10 ** dec;
    if (n === 0) return "0";
    if (n < 0.0001) return "<0.0001";
    return n.toFixed(dec === 18 ? 6 : 4);
  };

  const base = {
    platformFeeLabel: formatPlatformFeeLabel(),
    platformFeeDisplay: `${fmt(fee)} ${unit}`,
    swapAmountDisplay: `${fmt(net)} ${unit}`,
    grossDisplay: `${fmt(gross)} ${unit}`,
  };

  if (!opts?.creator) return base;

  const split = splitPlatformFee(fee, {
    creator: opts.creator,
    referrer: opts.referrer ?? null,
  });

  return {
    ...base,
    creatorShareDisplay: `${fmt(split.creator)} ${unit} (${feeShareLabels().creator})`,
    platformShareDisplay: `${fmt(split.platform)} ${unit} (${feeShareLabels().platform})`,
    referrerShareDisplay:
      split.referrer > BigInt(0)
        ? `${fmt(split.referrer)} ${unit} (${feeShareLabels().referrer})`
        : undefined,
  };
}
