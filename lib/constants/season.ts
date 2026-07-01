import type { WalletData } from "@/lib/types/wallet";

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const ACHIEVEMENTS = [
  { id: "score", baseId: 10, name: "Onchain Rank", icon: "🏅", unit: "Score", thresholds: [10, 30, 60, 75, 85], tierNames: ["Base Shrimp", "Base Dolphin", "Base Shark", "Base Whale", "Base God"], tierIcons: ["🦐", "🐬", "🦈", "🐋", "👑"] },
  { id: "age", baseId: 20, name: "Pioneer", icon: "📅", unit: "Days", thresholds: [10, 30, 90, 180, 365], tierNames: ["Newcomer", "Explorer", "Settler", "Veteran", "Early Adopter"], tierIcons: ["🥚", "🧭", "⛺", "🎖️", "🛸"] },
  { id: "name", baseId: 30, name: "Identity", icon: "📛", unit: "Basename", thresholds: [1], tierNames: ["Verified"], tierIcons: ["🆔"] },
  { id: "days", baseId: 40, name: "Diamond Hands", icon: "💎", unit: "Days", thresholds: [10, 50, 100, 200, 365], tierNames: ["Tourist", "Resident", "Citizen", "Patriot", "Immortal"], tierIcons: ["🎒", "🏠", "🏛️", "🛡️", "🗿"] },
  { id: "contract", baseId: 50, name: "Base Builder", icon: "🧱", unit: "Txs", thresholds: [10, 50, 100, 500, 1000], tierNames: ["Tinkerer", "Apprentice", "Engineer", "Architect", "Master Builder"], tierIcons: ["🔧", "🔨", "📐", "🏗️", "🌆"] },
  { id: "volume", baseId: 60, name: "Whale Alert", icon: "💰", unit: "ETH", thresholds: [0.001, 0.01, 0.1, 1.0, 5.0], tierNames: ["Guppy", "Puffer", "Angelfish", "Sailboat", "Leviathan"], tierIcons: ["🐟", "🐡", "🐠", "⛵", "🚢"] },
  { id: "txs", baseId: 70, name: "Power User", icon: "📈", unit: "Txs", thresholds: [10, 50, 100, 500, 1000], tierNames: ["Spark", "Bolt", "Surge", "Lightning", "Storm"], tierIcons: ["✨", "🌩️", "🌊", "⚡", "🌪️"] },
  { id: "swaps", baseId: 80, name: "DeFi Degen", icon: "🔄", unit: "Swaps", thresholds: [3, 10, 25, 50, 100], tierNames: ["Swapper", "Trader", "Provider", "Yield Farmer", "DeFi God"], tierIcons: ["🪙", "📈", "🏦", "🚜", "🦄"] },
  { id: "nfts", baseId: 90, name: "Collector", icon: "👾", unit: "NFTs", thresholds: [3, 10, 25, 50, 100], tierNames: ["Scout", "Gatherer", "Curator", "Connoisseur", "NFT Whale"], tierIcons: ["👁️", "🧺", "🖼️", "🍷", "🎨"] },
  { id: "streak", baseId: 100, name: "Streak Master", icon: "🎯", unit: "Days", thresholds: [3, 7, 14, 30, 100], tierNames: ["Match", "Flame", "Blaze", "Inferno", "Supernova"], tierIcons: ["🕯️", "🪔", "🔥", "🌋", "🌌"] },
  { id: "boosts", baseId: 110, name: "XP Booster", icon: "🔋", unit: "Boosts", thresholds: [5, 10, 25, 50, 100], tierNames: ["Novice", "Supporter", "Fanatic", "Champion", "Apex"], tierIcons: ["🔰", "🤝", "📣", "🏆", "🔋"] },
];

/** Actions completed inside Base Analytics — not passive on-chain history. */
export type AppQuestContext = {
  wallet: WalletData;
  streak: number;
  checkedToday: boolean;
  txKeys: Record<string, number>;
  x402PayCount: number;
  voucherBatchCount: number;
  referralInvites: number;
  didChallenge: boolean;
};

export type AppQuestTab = "predictions" | "checkin" | "achievements" | "basehub" | "dashboard";

export type WeeklyQuest = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  xp: number;
  tab?: AppQuestTab;
  check: (ctx: AppQuestContext) => boolean;
};

export const WEEKLY_QUESTS: WeeklyQuest[] = [
  {
    id: "q_pred_first",
    icon: "📈",
    title: "First prediction",
    desc: "Place your first YES or NO trade on any crypto market",
    xp: 55,
    tab: "predictions",
    check: (c) => (c.txKeys.prediction ?? 0) >= 1,
  },
  {
    id: "q_pred_3",
    icon: "🎯",
    title: "Active trader",
    desc: "Complete 3 prediction trades this week",
    xp: 50,
    tab: "predictions",
    check: (c) => (c.txKeys.prediction ?? 0) >= 3,
  },
  {
    id: "q_pred_5",
    icon: "🔥",
    title: "Market regular",
    desc: "Complete 5 prediction trades — top weekly XP",
    xp: 65,
    tab: "predictions",
    check: (c) => (c.txKeys.prediction ?? 0) >= 5,
  },
  {
    id: "q_pred_10",
    icon: "👑",
    title: "Prediction pro",
    desc: "Hit 10 prediction trades in one week",
    xp: 80,
    tab: "predictions",
    check: (c) => (c.txKeys.prediction ?? 0) >= 10,
  },
  {
    id: "q_checkin",
    icon: "🔥",
    title: "Daily check-in",
    desc: "Complete onchain check-in in this app",
    xp: 20,
    tab: "checkin",
    check: (c) => (c.txKeys.checkin ?? 0) >= 1 || c.checkedToday,
  },
  {
    id: "q_boost",
    icon: "🚀",
    title: "Fire XP Boost",
    desc: "Tap Boost on the Check-In tab",
    xp: 25,
    tab: "checkin",
    check: (c) => (c.txKeys.boost ?? 0) >= 1,
  },
  {
    id: "q_gm",
    icon: "☀️",
    title: "Say GM",
    desc: "Send GM from the Check-In tab",
    xp: 15,
    tab: "checkin",
    check: (c) => (c.txKeys.gm ?? 0) >= 1,
  },
  {
    id: "q_gn",
    icon: "🌙",
    title: "Say GN",
    desc: "Send GN from the Check-In tab",
    xp: 15,
    tab: "checkin",
    check: (c) => (c.txKeys.gn ?? 0) >= 1,
  },
  {
    id: "q_streak3",
    icon: "⚡",
    title: "3-day streak",
    desc: "Check in 3 days in a row via this app",
    xp: 30,
    tab: "checkin",
    check: (c) => c.streak >= 3,
  },
  {
    id: "q_streak7",
    icon: "🏆",
    title: "7-day streak",
    desc: "Finish the full 7-day check-in track",
    xp: 50,
    tab: "checkin",
    check: (c) => c.streak >= 7,
  },
  {
    id: "q_voucher",
    icon: "🎁",
    title: "Create gift cards",
    desc: "Create a Base Voucher batch in-app",
    xp: 35,
    tab: "basehub",
    check: (c) => c.voucherBatchCount >= 1,
  },
  {
    id: "q_redeem",
    icon: "🎫",
    title: "Redeem a voucher",
    desc: "Claim a Base Voucher gift card in-app",
    xp: 30,
    tab: "basehub",
    check: (c) => (c.txKeys.redeem ?? 0) >= 1,
  },
  {
    id: "q_x402",
    icon: "💳",
    title: "x402 Premium",
    desc: "Pay for Deep Scan, Export, or Compare once",
    xp: 30,
    tab: "dashboard",
    check: (c) => c.x402PayCount >= 1,
  },
  {
    id: "q_challenge",
    icon: "🎯",
    title: "Score battle",
    desc: "Challenge another wallet on Analytics",
    xp: 20,
    tab: "dashboard",
    check: (c) => c.didChallenge,
  },
  {
    id: "q_referral",
    icon: "🤝",
    title: "Refer a friend",
    desc: "Get 1+ friend to join via your referral link",
    xp: 25,
    tab: "dashboard",
    check: (c) => c.referralInvites >= 1,
  },
];

export const SEASON_START = new Date("2026-04-20T00:00:00Z");
export const SEASON_END = new Date("2026-10-20T23:59:59Z");
export const SEASON_NAME = "Season 1: Predictions";
export const TIER_GRADIENTS = [
  "from-slate-500 to-slate-600",
  "from-amber-500 to-orange-600",
  "from-slate-300 to-slate-500",
  "from-yellow-400 to-yellow-600",
  "from-blue-600 to-indigo-600",
];
