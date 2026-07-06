import { formatEther, formatUnits } from "ethers";
import { parseAbi } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { USDC_BASE } from "@/lib/constants/contracts";

const ERC20_BALANCE_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

export interface WalletBalances {
  ethWei: bigint;
  eth: number;
  usdc: number;
  portfolioValueUSD: number;
}

export async function fetchWalletBalances(
  address: string,
  ethUsd: number
): Promise<WalletBalances> {
  const pub = createBasePublicClient();
  const addr = address as `0x${string}`;

  const [ethWei, usdcRaw] = await Promise.all([
    pub.getBalance({ address: addr }).catch(() => BigInt(0)),
    pub
      .readContract({
        address: USDC_BASE as `0x${string}`,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [addr],
      })
      .catch(() => BigInt(0)),
  ]);

  const eth = parseFloat(formatEther(ethWei));
  const usdc = parseFloat(formatUnits(usdcRaw, 6));
  const portfolioValueUSD = parseFloat(
    (eth * ethUsd + usdc).toFixed(2)
  );

  return { ethWei, eth, usdc, portfolioValueUSD };
}
