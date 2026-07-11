import { decodeEventLog, type TransactionReceipt } from "viem";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";

const B20_CREATED_ABI = [
  {
    type: "event",
    name: "B20Created",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "variant", type: "uint8", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "decimals", type: "uint8", indexed: false },
      { name: "variantEventParams", type: "bytes", indexed: false },
    ],
  },
] as const;

export const B20_TOKEN_PLACEHOLDER =
  "0xb2000000000000000000000000000000000000" as const;

export function isInvalidLaunchTokenAddress(
  address: string | null | undefined
): boolean {
  if (!address || address.length !== 42) return true;
  const low = address.toLowerCase();
  return (
    low === B20_TOKEN_PLACEHOLDER ||
    low === B20_FACTORY_ADDRESS.toLowerCase()
  );
}

/** Read the real token address from a successful createB20 receipt. */
export function extractB20TokenFromReceipt(
  receipt: TransactionReceipt
): `0x${string}` | null {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== B20_FACTORY_ADDRESS.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: B20_CREATED_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "B20Created") continue;
      const token = decoded.args.token as `0x${string}`;
      if (!isInvalidLaunchTokenAddress(token)) return token;
    } catch {
      /* not B20Created */
    }
  }
  return null;
}
