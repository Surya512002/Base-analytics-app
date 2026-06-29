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

export const WEEKLY_QUESTS = [
  { id: "q_boost", icon: "🚀", title: "Boost your score", desc: "Use the XP Booster at least once", xp: 25, check: (w: WalletData, b: number) => b >= 1 },
  { id: "q_gm", icon: "☀️", title: "Say GM on Base", desc: "Send a GM transaction onchain", xp: 15, check: (w: WalletData, _b: number, _s: number, k?: Record<string, number>) => w.hasGm || !!(k?.gm && k.gm > 0) },
  { id: "q_checkin", icon: "🔥", title: "Onchain check-in", desc: "Complete a daily onchain check-in", xp: 20, check: (w: WalletData, _b: number, s: number, k?: Record<string, number>) => w.checkInCount >= 1 || s >= 1 || !!(k?.checkin && k.checkin > 0) },
  { id: "q_streak", icon: "⚡", title: "3-day streak", desc: "Maintain a 3+ day onchain streak", xp: 30, check: (_w: WalletData, _b: number, s: number) => s >= 3 },
  { id: "q_defi", icon: "🦄", title: "DeFi interaction", desc: "Interact with a DeFi protocol", xp: 40, check: (w: WalletData) => w.defiInteractions >= 1 },
  { id: "q_swap", icon: "🔄", title: "Token swap", desc: "Swap at least one token on Base", xp: 20, check: (w: WalletData) => w.swapCount >= 1 },
  { id: "q_nft", icon: "🎨", title: "Collect an NFT", desc: "Hold 1+ NFTs on Base network", xp: 35, check: (w: WalletData) => w.nftCount >= 1 },
  { id: "q_basename", icon: "🆔", title: "Claim Basename", desc: "Register a .base.eth username", xp: 50, check: (w: WalletData) => !!w.basename },
  { id: "q_vol", icon: "💎", title: "Volume milestone", desc: "Reach 0.001+ ETH transaction volume", xp: 30, check: (w: WalletData) => parseFloat(w.ethVolume) >= 0.001 },
  { id: "q_txs", icon: "📊", title: "Active trader", desc: "Complete 10+ transactions on Base", xp: 25, check: (w: WalletData) => w.txCount >= 10 },
];

export const SEASON_START = new Date("2026-04-20T00:00:00Z");
export const SEASON_END = new Date("2026-10-20T23:59:59Z");
export const SEASON_NAME = "Season 1: Genesis";
export const TIER_GRADIENTS = [
  "from-slate-500 to-slate-600",
  "from-amber-500 to-orange-600",
  "from-slate-300 to-slate-500",
  "from-yellow-400 to-yellow-600",
  "from-blue-600 to-indigo-600",
];
