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

export const VOUCHER_VIEW_TABS = [
  ["create", "Create"],
  ["redeem", "Redeem"],
  ["view", "View"],
  ["mine", "My Cards"],
] as const;
