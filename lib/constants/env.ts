export const ALCHEMY_KEY =
  process.env.ALCHEMY_API_KEY ||
  process.env.ALCHEMY_KEY ||
  process.env.NEXT_PUBLIC_ALCHEMY_KEY ||
  "";

function cleanKey(k: string | undefined): string {
  return (k || "").replace(/^["']|["']$/g, "").trim();
}

/** All Alchemy keys — comma list + single env vars (deduped). */
export function getAlchemyKeys(): string[] {
  const keys: string[] = [];
  const add = (raw: string | undefined) => {
    const t = cleanKey(raw);
    if (t && !keys.includes(t)) keys.push(t);
  };
  for (const part of (process.env.ALCHEMY_API_KEYS || "").split(",")) {
    add(part);
  }
  add(process.env.ALCHEMY_API_KEY);
  add(process.env.NEXT_PUBLIC_ALCHEMY_KEY);
  add(process.env.ALCHEMY_KEY);
  return keys;
}

export function alchemyRpcForKey(key: string): string {
  return `https://base-mainnet.g.alchemy.com/v2/${key}`;
}

export const BASE_PUBLIC_RPC = "https://mainnet.base.org";

export const BASE_RPC =
  process.env.BASE_RPC_URL ||
  (getAlchemyKeys()[0]
    ? alchemyRpcForKey(getAlchemyKeys()[0])
    : BASE_PUBLIC_RPC);

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
