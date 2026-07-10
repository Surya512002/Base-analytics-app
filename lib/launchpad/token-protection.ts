import { getLaunchedToken, patchLaunchedToken } from "@/lib/launchpad/token-store";
import type { LaunchedToken } from "@/lib/launchpad/types";

/** Persist pool open block once (first swap / pool activity). */
export async function ensurePoolOpenBlock(
  tokenAddress: string,
  blockNumber: number
): Promise<LaunchedToken | null> {
  const token = await getLaunchedToken(tokenAddress);
  if (!token) return null;
  if (token.poolOpenBlock && token.poolOpenBlock > 0) return token;
  return patchLaunchedToken(tokenAddress, { poolOpenBlock: blockNumber });
}
