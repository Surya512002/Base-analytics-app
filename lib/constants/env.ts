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

/** Client-safe Base RPC — public Base by default; skip capped Alchemy URLs. */
export const BASE_RPC = (() => {
  const explicit =
    process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim();
  if (explicit && !explicit.includes("alchemy.com")) return explicit;
  return BASE_PUBLIC_RPC;
})();

export const MINIAPP_URL =
  "https://farcaster.xyz/miniapps/lYFXQz4s1wsq/base-analytics";
export const APP_URL_WEB = "https://base-analytics-app.vercel.app";
export const BUILDER_CODE =
  process.env.NEXT_PUBLIC_BUILDER_CODE || "bc_4uoh9iu2";
export const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL || "";

const RAW_VOUCHER_CONTRACT = (process.env.NEXT_PUBLIC_VOUCHER_CONTRACT || "").trim();
// 0xE425b060d888DD54C57160f4c3B0d3Fb76EcCf25 is legacy BaseVoucher v1 (only ETH/USDC, lacks createTokenBatch).
// 0xc118afff969db6cd6d2de639e2c8ba1223768fce is BaseVoucher v2 (supports ERC20 tokenized stocks + custom configs).
export const VOUCHER_CONTRACT =
  !RAW_VOUCHER_CONTRACT || RAW_VOUCHER_CONTRACT.toLowerCase() === "0xe425b060d888dd54c57160f4c3b0d3fb76eccf25"
    ? "0xc118afff969db6cd6d2de639e2c8ba1223768fce"
    : RAW_VOUCHER_CONTRACT;
