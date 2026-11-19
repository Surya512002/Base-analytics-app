/**
 * Which chain Drops runs on. Base mainnet by default; set NEXT_PUBLIC_DROPS_CHAIN_ID=84532 on a
 * preview/staging deployment to run the whole Drops flow (contract, reads, tickets, wallet txs)
 * on Base Sepolia. The rest of the app stays on mainnet. The `drops-sepolia` preview branch runs this
 * way against the verified Sepolia deployment (docs/DROPS_SEPOLIA_RESULTS.md).
 */
import { createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { createPublicOnlyBaseClient } from "@/lib/utils/base-rpc";

export type DropsChainId = 8453 | 84532;

export const DROPS_CHAIN_ID: DropsChainId = (process.env.NEXT_PUBLIC_DROPS_CHAIN_ID || "").trim() === "84532" ? 84532 : 8453;
export const IS_DROPS_TESTNET = DROPS_CHAIN_ID === 84532;

export const DROPS_USDC: `0x${string}` = IS_DROPS_TESTNET
  ? "0x036CbD53842c5426634e7929541eC2318f3dCF7e" // Circle USDC on Base Sepolia (checked onchain: symbol USDC, 6 decimals)
  : "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export const DROPS_EXPLORER = IS_DROPS_TESTNET ? "https://sepolia.basescan.org" : "https://basescan.org";

const SEPOLIA_RPC = (process.env.NEXT_PUBLIC_DROPS_RPC_URL || "").trim() || "https://sepolia.base.org";

/** Public client for the Drops chain (browser and server). */
export function createDropsPublicClient() {
  if (!IS_DROPS_TESTNET) return createPublicOnlyBaseClient();
  return createPublicClient({ chain: baseSepolia, transport: http(SEPOLIA_RPC, { retryCount: 3, retryDelay: 400, timeout: 25_000 }) });
}

export const dropsViemChain = () => (IS_DROPS_TESTNET ? baseSepolia : base);
