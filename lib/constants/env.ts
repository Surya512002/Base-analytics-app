function cleanKey(k: string | undefined): string {
  return (k || "").replace(/^["']|["']$/g, "").trim();
}

/** Single Alchemy key — server prefers ALCHEMY_API_KEY, client uses NEXT_PUBLIC_ALCHEMY_KEY. */
export function getAlchemyKey(): string {
  return (
    cleanKey(process.env.ALCHEMY_API_KEY) ||
    cleanKey(process.env.ALCHEMY_KEY) ||
    cleanKey(process.env.NEXT_PUBLIC_ALCHEMY_KEY)
  );
}

export const ALCHEMY_KEY = getAlchemyKey();

/** @deprecated Use getAlchemyKey() — returns 0 or 1 key for legacy call sites. */
export function getAlchemyKeys(): string[] {
  const key = getAlchemyKey();
  return key ? [key] : [];
}

export function alchemyRpcForKey(key: string): string {
  return `https://base-mainnet.g.alchemy.com/v2/${key}`;
}

export const BASE_PUBLIC_RPC = "https://mainnet.base.org";

export const BASE_RPC =
  process.env.BASE_RPC_URL ||
  (getAlchemyKey() ? alchemyRpcForKey(getAlchemyKey()) : BASE_PUBLIC_RPC);

export const MINIAPP_URL =
  "https://farcaster.xyz/miniapps/lYFXQz4s1wsq/base-analytics";
export const APP_URL_WEB = "https://base-analytics-app.vercel.app";
export const BUILDER_CODE =
  process.env.NEXT_PUBLIC_BUILDER_CODE || "bc_4uoh9iu2";
export const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL || "";
export const VOUCHER_CONTRACT =
  process.env.NEXT_PUBLIC_VOUCHER_CONTRACT || "";
export const PREDICTIONS_CONTRACT =
  process.env.NEXT_PUBLIC_PREDICTIONS_CONTRACT || "";
