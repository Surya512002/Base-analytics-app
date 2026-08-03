import {
  ArrowLeftRight,
  BarChart3,
  Flame,
  Gift,
  Rocket,
  Trophy,
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
    hint: "B20 tokens & launch",
  },
  {
    id: "swap",
    label: "Swap",
    icon: ArrowLeftRight,
    hint: "Trade any token on Base",
  },
  {
    id: "dashboard",
    label: "Analytics",
    icon: BarChart3,
    hint: "Onchain score & heatmap",
  },
  {
    id: "basehub",
    label: "Vouchers",
    icon: Gift,
    hint: "Crypto gift cards",
  },
  {
    id: "checkin",
    label: "Quests",
    shortLabel: "Quests",
    icon: Flame,
    hint: "Check-in & weekly quests",
  },
  {
    id: "achievements",
    label: "Badges",
    icon: Trophy,
    hint: "Mint onchain badges",
  },
];
