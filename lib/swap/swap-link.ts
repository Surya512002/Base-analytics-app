import { getAddress, isAddress } from "viem";

export const NATIVE_ETH_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export interface SwapLinkParams {
  buy?: string | null;
  sell?: string | null;
  amount?: string | number | null;
}

export interface ParsedSwapParams {
  buy: string | null;
  sell: string | null;
  amount: string | null;
  isValidBuy: boolean;
  isValidSell: boolean;
  rawBuy: string | null;
  rawSell: string | null;
}

/**
 * Normalizes an address parameter:
 * - Accepts 42-char hex strings (checksummed or lowercase)
 * - Accepts "eth" / native ETH sentinel
 * - Returns checksummed or null if invalid
 */
export function normalizeTokenAddress(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.toLowerCase() === "eth") {
    return "eth";
  }
  if (isAddress(trimmed)) {
    return trimmed.toLowerCase();
  }
  return null;
}

/**
 * Checks whether an address is the native ETH sentinel.
 */
export function isNativeEthAddress(addr?: string | null): boolean {
  if (!addr) return false;
  const trimmed = addr.trim().toLowerCase();
  return trimmed === "eth" || trimmed === NATIVE_ETH_ADDRESS.toLowerCase();
}

/**
 * Shared helper to construct compliant `/swap?buy=<tokenAddress>&sell=<tokenAddress>&amount=<optional>` links.
 * Rejects symbols, normalizes addresses to lowercase hex (or 'eth' sentinel), and omits empty params.
 */
export function buildSwapLink({ buy, sell, amount }: SwapLinkParams): string {
  const params = new URLSearchParams();

  if (buy) {
    const normalizedBuy = normalizeTokenAddress(buy);
    if (normalizedBuy) {
      params.set("buy", normalizedBuy);
    }
  }

  if (sell) {
    const normalizedSell = normalizeTokenAddress(sell);
    if (normalizedSell) {
      params.set("sell", normalizedSell);
    }
  }

  if (amount != null) {
    const cleanAmount = String(amount).trim();
    const num = parseFloat(cleanAmount);
    if (Number.isFinite(num) && num > 0) {
      params.set("amount", cleanAmount);
    }
  }

  const qs = params.toString();
  return qs ? `/swap?${qs}` : "/swap";
}

/**
 * Parses and validates swap query parameters from a URL string or URLSearchParams.
 * Handles:
 * - Contract: ?buy=<addr>&sell=<addr>&amount=<val>
 * - Legacy fallback: ?token=<addr> mapped to buy
 * - Validates checksum / address validity
 * - Blocks selecting the same token on both sides by automatically resolving conflict
 */
export function parseSwapUrlParams(source?: string | URLSearchParams | null): ParsedSwapParams {
  if (!source) {
    return {
      buy: null,
      sell: null,
      amount: null,
      isValidBuy: false,
      isValidSell: false,
      rawBuy: null,
      rawSell: null,
    };
  }

  const searchParams =
    typeof source === "string"
      ? new URLSearchParams(source.includes("?") ? source.split("?")[1] : source)
      : source;

  // Primary contract: buy, sell, amount
  // Legacy fallback: token -> buy
  const rawBuy = searchParams.get("buy")?.trim() || searchParams.get("token")?.trim() || null;
  const rawSell = searchParams.get("sell")?.trim() || null;
  const rawAmount = searchParams.get("amount")?.trim() || null;

  const buy = normalizeTokenAddress(rawBuy);
  const sell = normalizeTokenAddress(rawSell);

  let amount: string | null = null;
  if (rawAmount) {
    const parsed = parseFloat(rawAmount);
    if (Number.isFinite(parsed) && parsed > 0) {
      amount = rawAmount;
    }
  }

  // Automatic conflict resolution: if buy and sell are the same token
  let resolvedSell = sell;
  if (buy && sell && buy.toLowerCase() === sell.toLowerCase()) {
    if (buy.toLowerCase() === "eth") {
      resolvedSell = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"; // USDC
    } else {
      resolvedSell = "eth";
    }
  }

  return {
    buy,
    sell: resolvedSell,
    amount,
    isValidBuy: Boolean(buy),
    isValidSell: Boolean(resolvedSell),
    rawBuy,
    rawSell,
  };
}
