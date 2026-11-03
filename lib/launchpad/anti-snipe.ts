export const DEFAULT_ANTI_SNIPE_BLOCKS = 40; // ~8 seconds on Base Denim 200ms blocks

export type AntiSnipeStatus = {
  active: boolean;
  blocksRemaining: number;
  protectionUntilBlock: number | null;
  poolOpenBlock: number | null;
  antiSnipeBlocks: number;
  message?: string;
};

export function evaluateAntiSnipe(params: {
  currentBlock: number;
  poolOpenBlock: number | null | undefined;
  antiSnipeBlocks: number | null | undefined;
  direction: "buy" | "sell";
  /** Fallback when poolOpenBlock not yet written (use launch block). */
  launchBlock?: number | null | undefined;
}): AntiSnipeStatus {
  const blocks = params.antiSnipeBlocks ?? DEFAULT_ANTI_SNIPE_BLOCKS;
  const poolOpen = params.poolOpenBlock ?? params.launchBlock ?? null;

  if (!poolOpen || blocks <= 0) {
    return {
      active: false,
      blocksRemaining: 0,
      protectionUntilBlock: null,
      poolOpenBlock: poolOpen,
      antiSnipeBlocks: blocks,
    };
  }

  const until = poolOpen + blocks;
  const remaining = Math.max(0, until - params.currentBlock);
  const active = params.direction === "buy" && params.currentBlock < until;
  const estSeconds = (remaining * 0.2).toFixed(1);

  return {
    active,
    blocksRemaining: remaining,
    protectionUntilBlock: until,
    poolOpenBlock: poolOpen,
    antiSnipeBlocks: blocks,
    message: active
      ? `Anti-snipe active — buys blocked for ${remaining} more block(s) (~${estSeconds}s on Base 200ms blocks)`
      : undefined,
  };
}
