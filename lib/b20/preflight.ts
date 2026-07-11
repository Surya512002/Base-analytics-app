import { formatEther, parseEther } from "viem";
import { isB20AssetActivated } from "@/lib/b20/activation";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

/** Rabby / public RPC often cannot estimate B20 precompile gas — set explicitly. */
export const B20_CREATE_GAS_LIMIT = BigInt(1_200_000);
export const B20_MINT_GAS_LIMIT = BigInt(200_000);

/** Minimum ETH reserved for B20 factory gas (create + optional seed tx). */
export const MIN_LAUNCH_GAS_ETH = parseEther("0.00003");

export function gasLimitForB20Target(to: string): bigint {
  return to.toLowerCase() === B20_FACTORY_ADDRESS.toLowerCase()
    ? B20_CREATE_GAS_LIMIT
    : B20_MINT_GAS_LIMIT;
}

export async function preflightB20Launch(
  address: `0x${string}`,
  opts?: { seedEthWei?: bigint }
): Promise<{
  activated: boolean;
  balanceEth: string;
  hasMinGas: boolean;
  minEth: string;
}> {
  const pub = createBasePublicClient();
  const seedWei = opts?.seedEthWei ?? BigInt(0);
  const minRequired = MIN_LAUNCH_GAS_ETH + seedWei;
  const [balance, activated] = await Promise.all([
    pub.getBalance({ address }),
    isB20AssetActivated(),
  ]);
  return {
    activated,
    balanceEth: formatEther(balance),
    hasMinGas: balance >= minRequired,
    minEth: formatEther(minRequired),
  };
}
