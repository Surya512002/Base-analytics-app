import {
  createPublicClient,
  fallback,
  http,
  type Transport,
} from "viem";
import { base } from "viem/chains";
import { ALCHEMY_KEY, BASE_PUBLIC_RPC } from "@/lib/constants/env";

/** Ordered RPC URLs — server `BASE_RPC_URL` first, then Alchemy, then public Base. */
export function getBaseRpcUrls(): string[] {
  const urls: string[] = [];
  const serverUrl = process.env.BASE_RPC_URL?.trim();
  if (serverUrl) urls.push(serverUrl);

  const key = ALCHEMY_KEY.replace(/^["']|["']$/g, "");
  if (key) urls.push(`https://base-mainnet.g.alchemy.com/v2/${key}`);

  urls.push(BASE_PUBLIC_RPC);
  return [...new Set(urls)];
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
  const msg = err instanceof Error ? err.message : String(err);
  return /compute units|rate limit|429|capacity|too many requests|throughput/i.test(
    msg
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
