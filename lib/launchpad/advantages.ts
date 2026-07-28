import { formatPlatformFeeLabel, LAUNCHPAD_PLATFORM_FEE_BPS } from "@/lib/constants/launchpad";
import { feeShareLabels } from "@/lib/launchpad/fee-split";

const shares = feeShareLabels();

export const LAUNCHPAD_ADVANTAGES = [
  {
    title: "$0 launch fee",
    detail: "Pay Base gas only — no platform cut on deploy",
  },
  {
    title: `${shares.creator} creator revenue`,
    detail: `${formatPlatformFeeLabel(LAUNCHPAD_PLATFORM_FEE_BPS)} swap fee · ${shares.creator} to you instantly`,
  },
  {
    title: `${shares.referrer} referrals`,
    detail: "Share ?ref= links — earn on every swap through your link",
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
