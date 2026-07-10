import { formatPlatformFeeLabel, LAUNCHPAD_PLATFORM_FEE_BPS } from "@/lib/constants/launchpad";

export const LAUNCHPAD_ADVANTAGES = [
  {
    title: "$0 launch fee",
    detail: "Pay Base gas only — no platform cut on deploy",
  },
  {
    title: `${formatPlatformFeeLabel(LAUNCHPAD_PLATFORM_FEE_BPS)} swap fee`,
    detail: "Lower than typical 1% launchpad buy tax",
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
    title: "True vested lock",
    detail: "Vested % stays unminted until vault ships — not liquid at genesis",
  },
  {
    title: "Points on launch & trade",
    detail: "Earn Base Analytics XP for every launch and swap",
  },
] as const;
