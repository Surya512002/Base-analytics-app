import { decodeEventLog, type Hex, type Log, keccak256, toHex, encodeAbiParameters, parseAbiParameters } from "viem";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";
import { getLaunchedToken } from "@/lib/launchpad/token-store";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

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

const B20_CREATED_TOPIC = keccak256(
  toHex("B20Created(address,uint8,string,string,uint8,bytes)")
);

const LOOKBACK = BigInt(200_000);
const creatorCache = new Map<string, string | null>();

function tokenTopic(address: string): Hex {
  return encodeAbiParameters(parseAbiParameters("address"), [
    address as `0x${string}`,
  ]);
}

/**
 * Resolve who should receive creator swap fees for a token.
 * Prefer app registry; fall back to B20 factory create tx sender.
 */
export async function resolveTokenCreator(
  tokenAddress: string
): Promise<`0x${string}` | null> {
  const addr = tokenAddress.trim().toLowerCase();
  if (!addr.startsWith("0x") || addr.length !== 42) return null;

  const registered = await getLaunchedToken(addr);
  if (registered?.creator?.startsWith("0x") && registered.creator.length === 42) {
    return registered.creator as `0x${string}`;
  }

  if (creatorCache.has(addr)) {
    const cached = creatorCache.get(addr);
    return cached ? (cached as `0x${string}`) : null;
  }

  // Only B20 vanity addresses are discoverable via factory events.
  if (!addr.startsWith("0xb20")) {
    creatorCache.set(addr, null);
    return null;
  }

  try {
    const client = createBasePublicClient();
    const latest = await client.getBlockNumber();
    const fromBlock = latest > LOOKBACK ? latest - LOOKBACK : BigInt(0);
    const logs = (await client.request({
      method: "eth_getLogs",
      params: [
        {
          address: B20_FACTORY_ADDRESS,
          fromBlock: toHex(fromBlock),
          toBlock: toHex(latest),
          topics: [B20_CREATED_TOPIC, tokenTopic(addr)],
        },
      ],
    })) as Log[];

    const match = logs[logs.length - 1];
    if (!match?.transactionHash) {
      creatorCache.set(addr, null);
      return null;
    }

    try {
      decodeEventLog({
        abi: B20_CREATED_ABI,
        data: match.data,
        topics: match.topics,
      });
    } catch {
      creatorCache.set(addr, null);
      return null;
    }

    const tx = await client.getTransaction({ hash: match.transactionHash as Hex });
    const creator = tx.from.toLowerCase();
    creatorCache.set(addr, creator);
    return creator as `0x${string}`;
  } catch (e) {
    console.warn("[resolve-creator]", addr, e);
    creatorCache.set(addr, null);
    return null;
  }
}
