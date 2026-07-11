import {
  createPublicClient,
  fallback,
  http,
  type Transport,
} from "viem";
import { base } from "viem/chains";
import { getAlchemyKey, BASE_PUBLIC_RPC, alchemyRpcForKey } from "@/lib/constants/env";

/** Ordered RPC URLs — public Base first (Alchemy free tier often hits monthly caps). */
export function getBaseRpcUrls(): string[] {
  const urls: string[] = [];
  const explicit =
    process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim();
  const key = getAlchemyKey();
  const alchemy = key ? alchemyRpcForKey(key) : null;

  if (explicit && !explicit.includes("alchemy.com")) {
    urls.push(explicit);
  }
  urls.push(BASE_PUBLIC_RPC);
  if (explicit?.includes("alchemy.com")) {
    urls.push(explicit);
  } else if (alchemy) {
    urls.push(alchemy);
  }

  return [...new Set(urls)];
}

/** Public Base RPC only — use for launch / tx confirmation to avoid capped Alchemy keys. */
export function createPublicOnlyBaseClient() {
  return createPublicClient({
    chain: base,
    transport: http(BASE_PUBLIC_RPC, {
      retryCount: 3,
      retryDelay: 400,
      timeout: 25_000,
    }),
  });
}

export function createBaseHttpTransport(): Transport {
  const urls = getBaseRpcUrls();
  const transports = urls.map((url) =>
    http(url, { retryCount: 2, retryDelay: 300, timeout: 20_000 })
  );
  if (transports.length === 1) return transports[0]!;
  return fallback(transports, { rank: false, retryCount: 1 });
}

export function createBasePublicClient() {
  return createPublicClient({
    chain: base,
    transport: createBaseHttpTransport(),
  });
}

export function isRpcRateLimitError(err: unknown): boolean {
  return isRpcInfrastructureError(err);
}

export function isRpcInfrastructureError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const cause =
    err instanceof Error && err.cause != null ? String(err.cause) : "";
  const combined = `${msg} ${cause}`.toLowerCase();
  return /compute units|rate limit|429|capacity|too many requests|throughput|monthly capacity|rpc request failed|fetch failed|eai_again|network|timeout|503|502|504/i.test(
    combined
  );
}

export async function withRpcRetry<T>(
  fn: () => Promise<T>,
  attempts = 4
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isRpcRateLimitError(e) || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw last;
}
