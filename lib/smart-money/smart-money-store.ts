/**
 * Smart Money Radar Store
 * Allows users to follow high-performing Base wallets and track their recent token purchases.
 */

export interface SmartMoneyWallet {
  address: string;
  label: string;
  winRatePct?: number;
  totalPnlUsd?: number;
  isPreset?: boolean;
}

export interface SmartMoneyBuyEvent {
  txHash: string;
  walletAddress: string;
  walletLabel: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  usdValue: number;
  timestamp: number;
}

export const PRESET_SMART_MONEY: SmartMoneyWallet[] = [
  {
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    label: "vitalik.eth (Base Holdings)",
    winRatePct: 92,
    totalPnlUsd: 120_000,
    isPreset: true,
  },
  {
    address: "0x3799cafa388da047cAF7c999e31c844705FadfAe",
    label: "Top Base Liquidity Pioneer",
    winRatePct: 84,
    totalPnlUsd: 48_500,
    isPreset: true,
  },
  {
    address: "0x8bcB8044719C6e1C526F76c8c4a5c531d279326F",
    label: "Base Ecosystem Alpha",
    winRatePct: 79,
    totalPnlUsd: 35_200,
    isPreset: true,
  },
];

const STORAGE_KEY = "base_smart_money_followed_wallets";

export function readFollowedSmartMoney(userWallet?: string | null): SmartMoneyWallet[] {
  if (typeof window === "undefined") return PRESET_SMART_MONEY;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userWallet?.toLowerCase() ?? "guest"}`);
    if (!raw) return PRESET_SMART_MONEY;
    const custom = JSON.parse(raw) as SmartMoneyWallet[];
    return [...PRESET_SMART_MONEY, ...custom];
  } catch {
    return PRESET_SMART_MONEY;
  }
}

export function followSmartMoney(
  userWallet: string | null | undefined,
  wallet: { address: string; label?: string }
): SmartMoneyWallet[] {
  if (typeof window === "undefined") return PRESET_SMART_MONEY;
  try {
    const key = `${STORAGE_KEY}_${userWallet?.toLowerCase() ?? "guest"}`;
    const raw = localStorage.getItem(key);
    const existing: SmartMoneyWallet[] = raw ? JSON.parse(raw) : [];
    const addr = wallet.address.toLowerCase();

    if (existing.some((w) => w.address.toLowerCase() === addr)) {
      return [...PRESET_SMART_MONEY, ...existing];
    }

    const updated = [
      ...existing,
      {
        address: wallet.address,
        label: wallet.label || `Whale ${wallet.address.slice(0, 6)}`,
        winRatePct: 75,
        totalPnlUsd: 10_000,
        isPreset: false,
      },
    ];
    localStorage.setItem(key, JSON.stringify(updated));
    return [...PRESET_SMART_MONEY, ...updated];
  } catch {
    return PRESET_SMART_MONEY;
  }
}

export function unfollowSmartMoney(
  userWallet: string | null | undefined,
  address: string
): SmartMoneyWallet[] {
  if (typeof window === "undefined") return PRESET_SMART_MONEY;
  try {
    const key = `${STORAGE_KEY}_${userWallet?.toLowerCase() ?? "guest"}`;
    const raw = localStorage.getItem(key);
    if (!raw) return PRESET_SMART_MONEY;
    const existing: SmartMoneyWallet[] = JSON.parse(raw);
    const updated = existing.filter((w) => w.address.toLowerCase() !== address.toLowerCase());
    localStorage.setItem(key, JSON.stringify(updated));
    return [...PRESET_SMART_MONEY, ...updated];
  } catch {
    return PRESET_SMART_MONEY;
  }
}
