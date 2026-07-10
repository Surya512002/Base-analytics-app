import { createPublicClient, http, keccak256, toBytes } from "viem";
import { base } from "viem/chains";
import {
  ACTIVATION_REGISTRY_ADDRESS,
  B20_ASSET_FEATURE_ID,
} from "@/lib/b20/constants";
import { createBaseHttpTransport, getBaseRpcUrls } from "@/lib/utils/base-rpc";

const ACTIVATION_ABI = [
  {
    name: "isActivated",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "featureId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function b20AssetFeatureHash(): `0x${string}` {
  return keccak256(toBytes(B20_ASSET_FEATURE_ID));
}

export async function isB20AssetActivated(
  rpcUrl?: string
): Promise<boolean> {
  const tryRead = async (
    transport: ReturnType<typeof http> | ReturnType<typeof createBaseHttpTransport>
  ) => {
    const pub = createPublicClient({ chain: base, transport });
    return pub.readContract({
      address: ACTIVATION_REGISTRY_ADDRESS,
      abi: ACTIVATION_ABI,
      functionName: "isActivated",
      args: [b20AssetFeatureHash()],
    });
  };

  const urls = rpcUrl ? [rpcUrl, ...getBaseRpcUrls()] : getBaseRpcUrls();

  for (const url of [...new Set(urls)]) {
    try {
      return await tryRead(http(url, { timeout: 15_000, retryCount: 1 }));
    } catch {
      /* try next RPC */
    }
  }

  try {
    return await tryRead(createBaseHttpTransport());
  } catch (e) {
    console.warn("[b20/activation] RPC unavailable — assuming activated", e);
    return true;
  }
}
