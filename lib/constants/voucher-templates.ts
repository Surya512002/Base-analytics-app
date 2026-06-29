import type { VoucherAsset } from "@/lib/utils/voucher";

export interface VoucherTemplate {
  id: string;
  label: string;
  emoji: string;
  total: string;
  cards: string;
  asset: VoucherAsset;
  message: string;
}

export const VOUCHER_TEMPLATES: VoucherTemplate[] = [
  {
    id: "gm-tip",
    label: "GM tip",
    emoji: "☀️",
    total: "1",
    cards: "1",
    asset: "USDC",
    message: "GM on Base! ☀️ Enjoy this onchain tip.",
  },
  {
    id: "birthday",
    label: "Birthday",
    emoji: "🎂",
    total: "10",
    cards: "1",
    asset: "USDC",
    message: "Happy Birthday! 🎂 Wishing you an amazing year on Base.",
  },
  {
    id: "thanks",
    label: "Thank you",
    emoji: "🙏",
    total: "5",
    cards: "5",
    asset: "USDC",
    message: "Thank you for being awesome — here's a little onchain gratitude.",
  },
  {
    id: "welcome",
    label: "Welcome",
    emoji: "👋",
    total: "5",
    cards: "5",
    asset: "USDC",
    message: "Welcome to Base! Your first crypto gift card awaits.",
  },
  {
    id: "team",
    label: "Team split",
    emoji: "🎁",
    total: "25",
    cards: "25",
    asset: "USDC",
    message: "From the team — thanks for building on Base together.",
  },
  {
    id: "eth-gm",
    label: "ETH GM",
    emoji: "⚡",
    total: "0.001",
    cards: "1",
    asset: "ETH",
    message: "GM fren — sent you a little ETH on Base.",
  },
];
