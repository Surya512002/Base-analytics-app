/** In-app activity badges — earned from Base Analytics usage, not passive chain history. */

export type AppBadgeSection =
  | "traded"
  | "staked"
  | "engaged"
  | "vouchers"
  | "social"
  | "explorer"
  | "legend";

export type AppBadgeCategory = {
  id: string;
  section: AppBadgeSection;
  name: string;
  icon: string;
  unit: string;
  metric: string;
  thresholds: number[];
  tierNames: string[];
  tierIcons: string[];
  /** Display difficulty hint on final tiers */
  elite?: boolean;
};

/** Steep lifetime thresholds — final tiers are intentionally rare. */
export const APP_TRADED_BADGES: AppBadgeCategory[] = [
  {
    id: "app_swap",
    section: "traded",
    name: "Terminal trader",
    icon: "📈",
    unit: "Swaps",
    metric: "swap",
    thresholds: [3, 15, 50, 120, 250, 500],
    tierNames: ["Paper hands", "Active", "Desk rat", "Terminal native", "Market animal", "Swap deity"],
    tierIcons: ["🪙", "📊", "⚡", "🔥", "🐋", "👑"],
    elite: true,
  },
  {
    id: "app_launch",
    section: "traded",
    name: "B20 launcher",
    icon: "🚀",
    unit: "Launches",
    metric: "launch",
    thresholds: [1, 5, 15, 40, 80, 150],
    tierNames: ["First spark", "Creator", "Serial launcher", "Factory hand", "Launch baron", "B20 architect"],
    tierIcons: ["🚀", "🛸", "🌌", "🏭", "🏗️", "🌠"],
    elite: true,
  },
  {
    id: "app_trade_combo",
    section: "traded",
    name: "Market maker",
    icon: "⚖️",
    unit: "Actions",
    metric: "trade_actions",
    thresholds: [10, 40, 100, 200, 400, 750],
    tierNames: ["Tourist", "Flow state", "Desk regular", "Liquidity lord", "Terminal whale", "Exchange ghost"],
    tierIcons: ["📎", "🔄", "💹", "🌊", "🐋", "👻"],
    elite: true,
  },
  {
    id: "app_swap_streak",
    section: "traded",
    name: "Volume hunter",
    icon: "🎯",
    unit: "Swaps",
    metric: "swap",
    thresholds: [75, 200, 400],
    tierNames: ["Hunter", "Predator", "Apex trader"],
    tierIcons: ["🎯", "🦈", "⚔️"],
    elite: true,
  },
];

export const APP_STAKED_BADGES: AppBadgeCategory[] = [
  {
    id: "app_stake",
    section: "staked",
    name: "Stake cadence",
    icon: "🔒",
    unit: "Stakes",
    metric: "stake",
    thresholds: [2, 8, 20, 45, 80, 150],
    tierNames: ["First lock", "Regular", "Committed", "Vault keeper", "Stake maxi", "Iron vault"],
    tierIcons: ["🔒", "⛓️", "🏦", "💎", "🏛️", "🗿"],
    elite: true,
  },
  {
    id: "app_eth_stake",
    section: "staked",
    name: "ETH stake tier",
    icon: "⚡",
    unit: "Tier",
    metric: "eth_stake_tier",
    thresholds: [1, 2, 3],
    tierNames: ["Bronze lock", "Silver lock", "Gold lock"],
    tierIcons: ["🥉", "🥈", "🥇"],
  },
  {
    id: "app_diamond_stake",
    section: "staked",
    name: "Diamond hands",
    icon: "💎",
    unit: "Stakes",
    metric: "stake",
    thresholds: [50, 100, 200],
    tierNames: ["Frosted", "Flawless", "Eternal"],
    tierIcons: ["💠", "💎", "♾️"],
    elite: true,
  },
];

export const APP_ENGAGED_BADGES: AppBadgeCategory[] = [
  {
    id: "app_checkin",
    section: "engaged",
    name: "Check-in monk",
    icon: "🔥",
    unit: "Check-ins",
    metric: "checkin",
    thresholds: [5, 20, 50, 100, 200, 365],
    tierNames: ["Initiate", "Disciplined", "Devoted", "Monk", "Ascetic", "Immortal"],
    tierIcons: ["✅", "📅", "🗓️", "🧘", "🏆", "🗿"],
    elite: true,
  },
  {
    id: "app_streak",
    section: "engaged",
    name: "Daily streak",
    icon: "🎯",
    unit: "Days",
    metric: "streak",
    thresholds: [7, 14, 30, 60, 100, 180],
    tierNames: ["Spark", "Ember", "Blaze", "Inferno", "Supernova", "Solar flare"],
    tierIcons: ["🕯️", "🔥", "🌋", "☄️", "🌌", "☀️"],
    elite: true,
  },
  {
    id: "app_boost",
    section: "engaged",
    name: "XP booster",
    icon: "🔋",
    unit: "Boosts",
    metric: "boost",
    thresholds: [3, 15, 40, 80, 150, 300],
    tierNames: ["Spark", "Charged", "Overdrive", "Turbo", "Reactor", "Singularity"],
    tierIcons: ["⚡", "🔋", "🚀", "💥", "☢️", "🌟"],
    elite: true,
  },
  {
    id: "app_grind",
    section: "engaged",
    name: "Activity grinder",
    icon: "⚙️",
    unit: "Actions",
    metric: "activity_total",
    thresholds: [25, 100, 250, 500, 1000],
    tierNames: ["Rookie", "Grinder", "Machine", "Relentless", "Unstoppable"],
    tierIcons: ["🔧", "⚙️", "🤖", "🦾", "🏗️"],
    elite: true,
  },
];

export const APP_VOUCHER_BADGES: AppBadgeCategory[] = [
  {
    id: "app_voucher",
    section: "vouchers",
    name: "Gift card creator",
    icon: "🎁",
    unit: "Batches",
    metric: "voucher",
    thresholds: [2, 8, 20, 50, 100, 200],
    tierNames: ["Wrapper", "Gifter", "Santa", "Treasury", "Mint master", "Gift tycoon"],
    tierIcons: ["🎁", "🎀", "🎄", "💳", "🏦", "🤑"],
    elite: true,
  },
  {
    id: "app_redeem",
    section: "vouchers",
    name: "Voucher redeemer",
    icon: "🎫",
    unit: "Redeems",
    metric: "redeem",
    thresholds: [3, 12, 30, 75, 150, 300],
    tierNames: ["Claimer", "Collector", "Hoarder", "Vault raider", "Redeem king", "Treasure lord"],
    tierIcons: ["🎫", "🧧", "💰", "🏦", "👑", "💎"],
    elite: true,
  },
  {
    id: "app_gift_economy",
    section: "vouchers",
    name: "Gift economy",
    icon: "💸",
    unit: "Actions",
    metric: "voucher_actions",
    thresholds: [10, 40, 100, 250, 500],
    tierNames: ["Participant", "Merchant", "Broker", "Tycoon", "Economy boss"],
    tierIcons: ["💵", "💳", "🏪", "🏦", "🌐"],
    elite: true,
  },
];

export const APP_SOCIAL_BADGES: AppBadgeCategory[] = [
  {
    id: "app_gm",
    section: "social",
    name: "GM crew",
    icon: "☀️",
    unit: "GMs",
    metric: "gm",
    thresholds: [5, 25, 75, 150, 300, 500],
    tierNames: ["Early bird", "Sunrise", "Dawn patrol", "Morning lord", "Solar priest", "GM god"],
    tierIcons: ["🌅", "☀️", "🌞", "🦅", "🔆", "👑"],
    elite: true,
  },
  {
    id: "app_gn",
    section: "social",
    name: "GN crew",
    icon: "🌙",
    unit: "GNs",
    metric: "gn",
    thresholds: [5, 25, 75, 150, 300, 500],
    tierNames: ["Night owl", "Moon walker", "Midnight", "Dreamer", "Lunar sage", "GN god"],
    tierIcons: ["🌙", "🌜", "✨", "💫", "🌠", "👑"],
    elite: true,
  },
  {
    id: "app_social_ping",
    section: "social",
    name: "Base socialite",
    icon: "💬",
    unit: "GM+GN",
    metric: "social_ping",
    thresholds: [20, 80, 200, 500, 1000],
    tierNames: ["Chatter", "Regular", "Personality", "Influencer", "Legend"],
    tierIcons: ["💬", "📣", "🎤", "📡", "🌟"],
    elite: true,
  },
];

export const APP_EXPLORER_BADGES: AppBadgeCategory[] = [
  {
    id: "app_x402",
    section: "explorer",
    name: "Premium explorer",
    icon: "💳",
    unit: "Payments",
    metric: "x402",
    thresholds: [2, 8, 20, 50, 100, 200],
    tierNames: ["Unlocked", "Pro", "Analyst", "Researcher", "Whale scan", "Oracle"],
    tierIcons: ["🔓", "📊", "🔬", "🧪", "🐋", "🔮"],
    elite: true,
  },
  {
    id: "app_challenge",
    section: "explorer",
    name: "Score battler",
    icon: "⚔️",
    unit: "Battles",
    metric: "challenge",
    thresholds: [3, 15, 40, 100, 200, 400],
    tierNames: ["Duelist", "Rival", "Gladiator", "Champion", "Warlord", "Undefeated"],
    tierIcons: ["🎯", "⚔️", "🛡️", "👑", "🏟️", "⚡"],
    elite: true,
  },
  {
    id: "app_referral",
    section: "explorer",
    name: "Referral captain",
    icon: "🤝",
    unit: "Invites",
    metric: "referral",
    thresholds: [3, 10, 25, 50, 100, 250],
    tierNames: ["Connector", "Ambassador", "Captain", "General", "Networker", "Empire"],
    tierIcons: ["👋", "🔗", "📣", "🌐", "🛰️", "👑"],
    elite: true,
  },
  {
    id: "app_prediction",
    section: "explorer",
    name: "Prediction sharp",
    icon: "🎲",
    unit: "Bets",
    metric: "prediction",
    thresholds: [5, 20, 50, 120, 250],
    tierNames: ["Gambler", "Sharp", "Oracle", "Prophet", "Time traveler"],
    tierIcons: ["🎲", "🎯", "🔮", "👁️", "⏳"],
    elite: true,
  },
];

export const APP_LEGEND_BADGES: AppBadgeCategory[] = [
  {
    id: "app_legend_terminal",
    section: "legend",
    name: "Terminal legend",
    icon: "🏛️",
    unit: "Actions",
    metric: "trade_actions",
    thresholds: [500, 1000, 2000],
    tierNames: ["Mythic", "Transcendent", "Eternal"],
    tierIcons: ["🏛️", "🌌", "♾️"],
    elite: true,
  },
  {
    id: "app_legend_grind",
    section: "legend",
    name: "Season grinder",
    icon: "🗿",
    unit: "Actions",
    metric: "activity_total",
    thresholds: [750, 1500, 3000, 5000],
    tierNames: ["Granite", "Obsidian", "Titanium", "Impossible"],
    tierIcons: ["🗿", "⬛", "🔩", "💀"],
    elite: true,
  },
  {
    id: "app_legend_streak",
    section: "legend",
    name: "Immortal streak",
    icon: "☀️",
    unit: "Days",
    metric: "streak",
    thresholds: [100, 200, 365],
    tierNames: ["Centurion", "Yearling", "Immortal"],
    tierIcons: ["💯", "📆", "♾️"],
    elite: true,
  },
  {
    id: "app_legend_referral",
    section: "legend",
    name: "Network sovereign",
    icon: "🌍",
    unit: "Invites",
    metric: "referral",
    thresholds: [100, 250, 500],
    tierNames: ["Sovereign", "Dynasty", "World"],
    tierIcons: ["🌍", "👑", "🌐"],
    elite: true,
  },
];

export const APP_BADGE_SECTIONS: {
  id: AppBadgeSection;
  title: string;
  subtitle: string;
  categories: AppBadgeCategory[];
}[] = [
  {
    id: "traded",
    title: "Traded",
    subtitle: "Lifetime swaps and B20 launches — top tiers need hundreds of actions.",
    categories: APP_TRADED_BADGES,
  },
  {
    id: "staked",
    title: "Staked",
    subtitle: "Repeated XP locks and on-chain ETH stake tiers.",
    categories: APP_STAKED_BADGES,
  },
  {
    id: "engaged",
    title: "Engaged",
    subtitle: "Daily check-ins, streaks, boosts, and total app grind.",
    categories: APP_ENGAGED_BADGES,
  },
  {
    id: "vouchers",
    title: "Vouchers",
    subtitle: "Create and redeem gift cards — elite tiers need serious volume.",
    categories: APP_VOUCHER_BADGES,
  },
  {
    id: "social",
    title: "Social",
    subtitle: "GM, GN, and combined social pings over time.",
    categories: APP_SOCIAL_BADGES,
  },
  {
    id: "explorer",
    title: "Explorer",
    subtitle: "Premium tools, battles, referrals, and quests.",
    categories: APP_EXPLORER_BADGES,
  },
  {
    id: "legend",
    title: "Legend",
    subtitle: "Endgame badges — only for the most dedicated Base Analytics users.",
    categories: APP_LEGEND_BADGES,
  },
];

export const APP_BADGE_CATEGORIES: AppBadgeCategory[] = APP_BADGE_SECTIONS.flatMap(
  (s) => s.categories
);

/** Base XP per tier — higher tiers pay more (tier index 1-based). */
export function appBadgeXpForTier(tier: number): number {
  const table = [0, 20, 35, 55, 80, 120, 175];
  return table[Math.min(tier, table.length - 1)] ?? 175;
}

export const XP_PER_APP_BADGE_CLAIM = 20;
