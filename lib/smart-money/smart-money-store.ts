/**
 * Smart Money Radar Store
 * Allows users to follow high-performing Base wallets and track their recent token purchases.
 * Works seamlessly in browser (localStorage) and Node/testing environments (in-memory).
 */

export interface SmartMoneyWallet {
  address: string;
  label: string;
  tag: string;
  isPreset?: boolean;
}

export interface SmartMoneyBuyEvent {
  txHash: string;
  walletAddress: string;
  walletLabel: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  usdValue: number | null;
  timestamp: number;
}

export const PRESET_SMART_MONEY: SmartMoneyWallet[] = [
  {
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    label: "vitalik.eth (Base Active)",
    tag: "Ecosystem Whale",
    isPreset: true,
  },
  {
    address: "0x3799cafa388da047cAF7c999e31c844705FadfAe",
    label: "Aerodrome Liquidity Provider",
    tag: "Aerodrome Top LP",
    isPreset: true,
  },
  {
    address: "0x8bcB8044719c6e1C526f76c8C4a5c531D279326F",
    label: "Base Ecosystem Alpha",
    tag: "Base DEX Trader",
    isPreset: true,
  },
];

const STORAGE_KEY = "base_smart_money_followed_wallets";

let memoryStorage: Record<string, string> = {};

export function _resetMemoryStoreForTesting(): void {
  memoryStorage = {};
}

function getItem(key: string): string | null {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      return localStorage.getItem(key);
    } catch {
      return memoryStorage[key] ?? null;
    }
  }
  return memoryStorage[key] ?? null;
}

function setItem(key: string, value: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(key, value);
      return;
    } catch {
      memoryStorage[key] = value;
      return;
    }
  }
  memoryStorage[key] = value;
}

export function readFollowedSmartMoney(userWallet?: string | null): SmartMoneyWallet[] {
  try {
    const key = `${STORAGE_KEY}_${userWallet?.toLowerCase() ?? "guest"}`;
    const raw = getItem(key);
    if (!raw) return PRESET_SMART_MONEY;
    const custom = JSON.parse(raw) as SmartMoneyWallet[];
    return [...PRESET_SMART_MONEY, ...custom];
  } catch {
    return PRESET_SMART_MONEY;
  }
}

export function followSmartMoney(
  userWallet: string | null | undefined,
  wallet: { address: string; label?: string; tag?: string }
): SmartMoneyWallet[] {
  try {
    const key = `${STORAGE_KEY}_${userWallet?.toLowerCase() ?? "guest"}`;
    const raw = getItem(key);
    const existing: SmartMoneyWallet[] = raw ? JSON.parse(raw) : [];
    const addr = wallet.address.toLowerCase();

    // Check if already in presets or custom
    if (
      PRESET_SMART_MONEY.some((w) => w.address.toLowerCase() === addr) ||
      existing.some((w) => w.address.toLowerCase() === addr)
    ) {
      return [...PRESET_SMART_MONEY, ...existing];
    }

    const updated: SmartMoneyWallet[] = [
      ...existing,
      {
        address: wallet.address,
        label: wallet.label || `Whale ${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`,
        tag: wallet.tag || "Tracked Wallet",
        isPreset: false,
      },
    ];
    setItem(key, JSON.stringify(updated));
    return [...PRESET_SMART_MONEY, ...updated];
  } catch {
    return PRESET_SMART_MONEY;
  }
}

export function unfollowSmartMoney(
  userWallet: string | null | undefined,
  address: string
): SmartMoneyWallet[] {
  try {
    const key = `${STORAGE_KEY}_${userWallet?.toLowerCase() ?? "guest"}`;
    const raw = getItem(key);
    if (!raw) return PRESET_SMART_MONEY;
    const existing: SmartMoneyWallet[] = JSON.parse(raw);
    const updated = existing.filter((w) => w.address.toLowerCase() !== address.toLowerCase());
    setItem(key, JSON.stringify(updated));
    return [...PRESET_SMART_MONEY, ...updated];
  } catch {
    return PRESET_SMART_MONEY;
  }
}
