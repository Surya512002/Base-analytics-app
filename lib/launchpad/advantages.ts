import { formatPlatformFeeLabel, LAUNCHPAD_PLATFORM_FEE_BPS } from "@/lib/constants/launchpad";
import { feeShareLabels } from "@/lib/launchpad/fee-split";

const shares = feeShareLabels();

export const LAUNCHPAD_ADVANTAGES = [
  {
    title: "$0 launch fee",
    detail: "Pay Base gas only — no platform cut on deploy",
  },
  {
    title: "0.25% creator revenue",
    detail: `${formatPlatformFeeLabel(LAUNCHPAD_PLATFORM_FEE_BPS)} total swap fee · 0.25% straight to creator`,
  },
  {
    title: "0.25% platform fee",
    detail: "Transparent 50/50 split — zero referral cuts or hidden fees",
  },
  {
    title: "Stock & B20 Pairs",
    detail: "Pair with NVDAc, AAPLc, TSLAc, ETH or USDC via Base standards",
  },
  {
    title: "Dual DEX routing",
    detail: "Auto-picks best quote on Uniswap V3 or Aerodrome",
  },
  {
    title: "Vanity 0xB200…",
    detail: "On-chain branded addresses via salt grinding",
  },
  {
    title: "Sign in · no gas",
    detail: "One signature secures your creator profile & fee dashboard",
  },
] as const;
