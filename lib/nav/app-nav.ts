import {
  ArrowLeftRight,
  Coins,
  Gift,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";

export type AppNavItem = {
  id: AppTab;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  hint: string;
};

/** Single source of truth — desktop sidebar + mobile bottom nav */
export const APP_NAV: AppNavItem[] = [
  {
    id: "launchpad",
    label: "Explore",
    icon: Rocket,
    hint: "Stocks, B20 & launches",
  },
  {
    id: "swap",
    label: "Swap",
    icon: ArrowLeftRight,
    hint: "Trade any token on Base",
  },
  {
    id: "lend",
    label: "Lend & Stake",
    shortLabel: "Lend",
    icon: Coins,
    hint: "Stock loans, Morpho & Aero",
  },
  {
    id: "basehub",
    label: "Vouchers",
    icon: Gift,
    hint: "Crypto gift cards",
  },
];
