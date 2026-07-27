import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import { enrichSwapCounter } from "@/lib/launchpad/token-logo";
import { WETH_BASE } from "@/lib/launchpad/uniswap";
import type { SwapAsset } from "@/lib/launchpad/tokens-base";

export type SwapTokenMeta = {
  address: string;
  symbol: string;
  decimals: number;
  imageUrl?: string;
};

export function metaToCounter(meta: SwapTokenMeta): SwapCounter {
  return enrichSwapCounter({
    kind: "token",
    address: meta.address,
    symbol: meta.symbol,
    decimals: meta.decimals,
    imageUrl: meta.imageUrl,
  });
}

export function launchedToCounter(token: {
  address: string;
  symbol: string;
  decimals: number;
  imageUrl?: string;
}): SwapCounter {
  return metaToCounter({
    address: token.address,
    symbol: token.symbol,
    decimals: token.decimals,
    imageUrl: token.imageUrl,
  });
}

function isWeth(counter: SwapCounter): boolean {
  return (
    counter.kind === "token" &&
    counter.address.toLowerCase() === WETH_BASE.toLowerCase()
  );
}

/** Treat WETH as native ETH for routing and pair selection. */
export function normalizeEthWeth(counter: SwapCounter): SwapCounter {
  if (isWeth(counter)) return { kind: "eth" };
  return counter;
}

export type DexSwapRoute = {
  pageToken: SwapTokenMeta;
  direction: "buy" | "sell";
  payAsset: SwapAsset;
  receiveAsset: SwapAsset;
  payToken: string | null;
  receiveToken: string | null;
  counterDecimals: number;
  payCounter: SwapCounter;
  receiveCounter: SwapCounter;
  /** True when neither leg is native ETH — routes through 0x. */
  needsAggregator: boolean;
};

export function resolveDexSwapRoute(
  from: SwapCounter,
  to: SwapCounter
): DexSwapRoute | null {
  const f = normalizeEthWeth(from);
  const t = normalizeEthWeth(to);

  if (f.kind === "eth" && t.kind === "eth") return null;
  if (
    f.kind !== "eth" &&
    t.kind !== "eth" &&
    f.address.toLowerCase() === t.address.toLowerCase()
  ) {
    return null;
  }

  const needsAggregator = f.kind !== "eth" && t.kind !== "eth";

  if (t.kind === "eth") {
    if (f.kind === "eth") return null;
    const page: SwapTokenMeta = {
      address: f.address,
      symbol: f.symbol,
      decimals: f.decimals,
      imageUrl: f.imageUrl,
    };
    return {
      pageToken: page,
      direction: "sell",
      payAsset: "eth",
      receiveAsset: "eth",
      payToken: null,
      receiveToken: null,
      counterDecimals: 18,
      payCounter: f,
      receiveCounter: { kind: "eth" },
      needsAggregator,
    };
  }

  if (f.kind === "eth") {
    const page: SwapTokenMeta = {
      address: t.address,
      symbol: t.symbol,
      decimals: t.decimals,
      imageUrl: t.imageUrl,
    };
    return {
      pageToken: page,
      direction: "buy",
      payAsset: "eth",
      receiveAsset: "eth",
      payToken: null,
      receiveToken: null,
      counterDecimals: 18,
      payCounter: { kind: "eth" },
      receiveCounter: t,
      needsAggregator,
    };
  }

  const page: SwapTokenMeta = {
    address: t.address,
    symbol: t.symbol,
    decimals: t.decimals,
    imageUrl: t.imageUrl,
  };
  return {
    pageToken: page,
    direction: "buy",
    payAsset: "token",
    receiveAsset: "eth",
    payToken: f.address,
    receiveToken: null,
    counterDecimals: f.decimals,
    payCounter: f,
    receiveCounter: t,
    needsAggregator,
  };
}
