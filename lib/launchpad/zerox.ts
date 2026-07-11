/**
 * 0x Swap API v2 (AllowanceHolder flow) — server-side only.
 * Aggregator fallback when no direct WETH pool exists on Uniswap V3,
 * Aerodrome classic, or Slipstream. Routes through USDC pairs,
 * multi-hop paths, and every DEX 0x indexes on Base.
 */

const ZEROX_API = "https://api.0x.org/swap/allowance-holder";
const BASE_CHAIN_ID = 8453;

/** 0x sentinel for native ETH. */
export const ZEROX_NATIVE_ETH =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;

export function zeroXConfigured(): boolean {
  return Boolean(process.env.ZEROX_API_KEY?.trim());
}

export type ZeroXPriceResult = {
  liquidityAvailable: boolean;
  buyAmount: bigint;
  minBuyAmount: bigint;
};

export type ZeroXQuoteResult = ZeroXPriceResult & {
  to: `0x${string}` | null;
  data: `0x${string}` | null;
  value: bigint;
  /** Approve this spender (AllowanceHolder) before ERC20 sells. */
  allowanceSpender: `0x${string}` | null;
};

type ZeroXApiResponse = {
  liquidityAvailable?: boolean;
  buyAmount?: string;
  minBuyAmount?: string;
  transaction?: { to?: string; data?: string; value?: string };
  issues?: { allowance?: { spender?: string } | null };
};

async function zeroXFetch(
  endpoint: "price" | "quote",
  params: Record<string, string>
): Promise<ZeroXApiResponse | null> {
  const key = process.env.ZEROX_API_KEY?.trim();
  if (!key) return null;

  const qs = new URLSearchParams({ chainId: String(BASE_CHAIN_ID), ...params });
  try {
    const res = await fetch(`${ZEROX_API}/${endpoint}?${qs}`, {
      headers: { "0x-api-key": key, "0x-version": "v2" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as ZeroXApiResponse;
  } catch {
    return null;
  }
}

function toBigInt(raw: string | undefined): bigint {
  try {
    return BigInt(raw ?? "0");
  } catch {
    return BigInt(0);
  }
}

/** Indicative price — no taker needed. Used for quote display / route discovery. */
export async function fetchZeroXPrice(params: {
  sellToken: string;
  buyToken: string;
  sellAmount: bigint;
  slippageBps: number;
}): Promise<ZeroXPriceResult> {
  const data = await zeroXFetch("price", {
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    sellAmount: params.sellAmount.toString(),
    slippageBps: String(Math.min(5000, Math.max(1, params.slippageBps))),
  });

  const buyAmount = toBigInt(data?.buyAmount);
  return {
    liquidityAvailable: data?.liquidityAvailable === true && buyAmount > BigInt(0),
    buyAmount,
    minBuyAmount: toBigInt(data?.minBuyAmount),
  };
}

/** Firm quote with executable calldata — requires taker address. */
export async function fetchZeroXQuote(params: {
  sellToken: string;
  buyToken: string;
  sellAmount: bigint;
  slippageBps: number;
  taker: string;
}): Promise<ZeroXQuoteResult> {
  const data = await zeroXFetch("quote", {
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    sellAmount: params.sellAmount.toString(),
    slippageBps: String(Math.min(5000, Math.max(1, params.slippageBps))),
    taker: params.taker,
  });

  const buyAmount = toBigInt(data?.buyAmount);
  const to = data?.transaction?.to;
  const txData = data?.transaction?.data;
  const spender = data?.issues?.allowance?.spender;

  return {
    liquidityAvailable:
      data?.liquidityAvailable === true && buyAmount > BigInt(0) && Boolean(to && txData),
    buyAmount,
    minBuyAmount: toBigInt(data?.minBuyAmount),
    to: (to as `0x${string}`) ?? null,
    data: (txData as `0x${string}`) ?? null,
    value: toBigInt(data?.transaction?.value),
    allowanceSpender: (spender as `0x${string}`) ?? null,
  };
}
