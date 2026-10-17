import type { OccasionTemplate, CardTheme } from "./voucher-types";

export const USDC_PRESETS = [
  { label: "$1", total: "1", cards: "1" },
  { label: "$5", total: "5", cards: "5" },
  { label: "$10", total: "10", cards: "10" },
  { label: "$25", total: "25", cards: "25" },
] as const;

export const ETH_PRESETS = [
  { label: "0.001", total: "0.001", cards: "1" },
  { label: "0.005", total: "0.005", cards: "5" },
  { label: "0.01", total: "0.01", cards: "10" },
  { label: "0.025", total: "0.025", cards: "25" },
] as const;

export const STOCK_PRESETS = [
  { label: "0.1 share", total: "0.1", cards: "1" },
  { label: "0.5 share", total: "0.5", cards: "1" },
  { label: "1 share", total: "1", cards: "1" },
  { label: "2 shares", total: "2", cards: "2" },
  { label: "5 shares", total: "5", cards: "5" },
] as const;

export const VAULT_PRESETS = [
  { label: "0.5 share", total: "0.5", cards: "1" },
  { label: "1 share", total: "1", cards: "1" },
  { label: "2 shares", total: "2", cards: "2" },
  { label: "5 shares", total: "5", cards: "5" },
  { label: "10 shares", total: "10", cards: "10" },
] as const;

export const QUICK_CARD_PRESETS = [1, 5, 10, 25] as const;

export const CARD_THEME_OPTIONS: Array<{
  id: CardTheme;
  label: string;
  gradient: string;
  borderColor: string;
  accentColor: string;
}> = [
  {
    id: "base-blue",
    label: "Base Blue",
    gradient: "linear-gradient(135deg, #0052ff 0%, #002d9c 45%, #080c1d 100%)",
    borderColor: "rgba(0, 82, 255, 0.45)",
    accentColor: "#0052ff",
  },
  {
    id: "midnight",
    label: "Midnight",
    gradient: "linear-gradient(135deg, #1e293b 0%, #0f172a 45%, #020617 100%)",
    borderColor: "rgba(148, 163, 184, 0.3)",
    accentColor: "#94a3b8",
  },
  {
    id: "stock",
    label: "Stock",
    gradient: "linear-gradient(135deg, #071f3d 0%, #0a3366 45%, #09182b 100%)",
    borderColor: "rgba(56, 189, 248, 0.4)",
    accentColor: "#38bdf8",
  },
  {
    id: "mint",
    label: "Mint",
    gradient: "linear-gradient(135deg, #064e3b 0%, #065f46 45%, #022c22 100%)",
    borderColor: "rgba(16, 185, 129, 0.4)",
    accentColor: "#10b981",
  },
];

export const OCCASION_TEMPLATES: OccasionTemplate[] = [
  {
    id: "gm",
    label: "GM",
    emoji: "☀️",
    message: "gm! Building on Base together 🔵",
    theme: "base-blue",
  },
  {
    id: "birthday",
    label: "Birthday",
    emoji: "🎂",
    message: "Happy Birthday! Enjoy your onchain gift 🎂",
    theme: "mint",
  },
  {
    id: "thankyou",
    label: "Thank you",
    emoji: "🙏",
    message: "Thank you for your support and partnership! 💙",
    theme: "base-blue",
  },
  {
    id: "welcome",
    label: "Welcome",
    emoji: "👋",
    message: "Welcome to Base & onchain finance 🚀",
    theme: "stock",
  },
  {
    id: "team",
    label: "Team split",
    emoji: "👥",
    message: "Team reward & onchain milestone split 🎉",
    theme: "midnight",
  },
];

export const POPULAR_GIFT_STOCKS = [
  { symbol: "NVDAc", name: "NVIDIA", icon: "🤖" },
  { symbol: "AAPLc", name: "Apple", icon: "🍏" },
  { symbol: "TSLAc", name: "Tesla", icon: "⚡" },
  { symbol: "COINc", name: "Coinbase", icon: "🪙" },
  { symbol: "GOOGLc", name: "Alphabet", icon: "🔍" },
  { symbol: "MSFTc", name: "Microsoft", icon: "💻" },
  { symbol: "AMZNc", name: "Amazon", icon: "📦" },
  { symbol: "METAc", name: "Meta", icon: "🌐" },
  { symbol: "PLTRc", name: "Palantir", icon: "🔮" },
  { symbol: "MSTRc", name: "MicroStrategy", icon: "₿" },
] as const;

export const POPULAR_GIFT_VAULTS = [
  {
    symbol: "mvNVDAc",
    name: "Morpho NVDA Yield Vault",
    apy: 8.45,
    protocol: "Morpho Blue",
    icon: "⚡",
  },
  {
    symbol: "mvAAPLc",
    name: "Morpho Apple Yield Vault",
    apy: 6.50,
    protocol: "Morpho Midnight",
    icon: "🍏",
  },
  {
    symbol: "sfNVDAc",
    name: "SuperStocks NVDA Carry Vault",
    apy: 13.85,
    protocol: "Superform",
    icon: "🔮",
  },
  {
    symbol: "mvCOINc",
    name: "Morpho Coinbase Yield Vault",
    apy: 9.15,
    protocol: "Morpho Blue",
    icon: "🪙",
  },
] as const;

export const VOUCHER_VIEW_TABS = [
  ["create", "Create"],
  ["redeem", "Redeem"],
  ["mine", "My Cards"],
] as const;
