import { createPublicClient, getAddress, http, type PublicClient } from "viem";
import { base, baseSepolia } from "viem/chains";
import { orderBookAbi } from "@/limit-orders/shared/abi";
import { getLimitOrdersConfig } from "@/src/config/limitOrders";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { getReadyRedis } from "@/lib/redis-cache";
import type { RulesDeps, StoredRules } from "./rules-service";

const ZERO = /^0x0{40}$/i;
const KEY_TTL_SEC = 400 * 24 * 3600;
export const SUPPORTED_CHAINS = [8453, 84532] as const;

export const rulesKey = (chainId: number, planId: string) => `planrules:v1:${chainId}:${planId}`;

function clientFor(chainId: number): PublicClient {
  return (chainId === 84532 ? createPublicClient({ chain: baseSepolia, transport: http() }) : createBasePublicClient()) as PublicClient;
}

export function orderBookFor(chainId: number): string | null {
  if (!(SUPPORTED_CHAINS as readonly number[]).includes(chainId)) return null;
  const book = getLimitOrdersConfig(chainId).orderBook;
  return book && !ZERO.test(book) ? book : null;
}

export async function readStored(chainId: number, planId: string): Promise<StoredRules | null> {
  const redis = await getReadyRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(rulesKey(chainId, planId));
    return raw ? (JSON.parse(raw) as StoredRules) : null;
  } catch {
    return null;
  }
}

export const realDeps: RulesDeps = {
  nowSec: () => Math.floor(Date.now() / 1000),
  orderBookFor,
  async readPlan(chainId, planId) {
    const book = orderBookFor(chainId);
    if (!book) return null;
    try {
      const p = (await clientFor(chainId).readContract({ address: getAddress(book), abi: orderBookAbi, functionName: "getPlan", args: [BigInt(planId)] })) as { owner: string; status: number };
      if (!p || /^0x0{40}$/i.test(p.owner)) return null;
      return { owner: p.owner, status: Number(p.status) };
    } catch {
      return null;
    }
  },
  async verify({ chainId, address, message, signature }) {
    try {
      return await clientFor(chainId).verifyMessage({ address: getAddress(address), message, signature: signature as `0x${string}` });
    } catch {
      return false;
    }
  },
  load: readStored,
  async save(chainId, planId, entry) {
    const redis = await getReadyRedis();
    if (!redis) return false;
    try {
      await redis.set(rulesKey(chainId, planId), JSON.stringify(entry), "EX", KEY_TTL_SEC);
      return (await redis.exists(rulesKey(chainId, planId))) === 1;
    } catch {
      return false;
    }
  },
};
