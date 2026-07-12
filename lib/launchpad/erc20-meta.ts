import { parseAbi } from "viem";
import { createPublicOnlyBaseClient } from "@/lib/utils/base-rpc";

const ERC20_DECIMALS_ABI = parseAbi(["function decimals() view returns (uint8)"]);

/** Read on-chain ERC-20 decimals (8 for cbBTC, 6 for USDC, 18 default). */
export async function fetchErc20Decimals(
  address: `0x${string}`,
  fallback = 18
): Promise<number> {
  try {
    const pub = createPublicOnlyBaseClient();
    const d = await pub.readContract({
      address,
      abi: ERC20_DECIMALS_ABI,
      functionName: "decimals",
    });
    const n = Number(d);
    if (Number.isFinite(n) && n >= 0 && n <= 18) return n;
  } catch {
    /* fallback */
  }
  return fallback;
}
