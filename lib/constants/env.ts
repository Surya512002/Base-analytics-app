export const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY || "";
export const BASE_PUBLIC_RPC = "https://mainnet.base.org";
export const BASE_RPC = ALCHEMY_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : BASE_PUBLIC_RPC;
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
