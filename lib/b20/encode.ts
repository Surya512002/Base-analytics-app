import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbiParameters,
  toBytes,
  type Hex,
} from "viem";
import {
  B20_FACTORY_ADDRESS,
  B20_VARIANT_ASSET,
  B20_ASSET_CREATE_PARAMS_VERSION,
  MINT_ROLE,
  METADATA_ROLE,
  MAX_SUPPLY_CAP,
} from "@/lib/b20/constants";

const B20_FACTORY_ABI = [
  {
    name: "createB20",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "variant", type: "uint8" },
      { name: "salt", type: "bytes32" },
      { name: "params", type: "bytes" },
      { name: "initCalls", type: "bytes[]" },
    ],
    outputs: [{ name: "token", type: "address" }],
  },
  {
    name: "getB20Address",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "variant", type: "uint8" },
      { name: "sender", type: "address" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const B20_TOKEN_ABI = [
  {
    name: "grantRole",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "updateSupplyCap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "newSupplyCap", type: "uint256" }],
    outputs: [],
  },
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "batchMint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    name: "updateExtraMetadata",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const ZERO_ADMIN = "0x0000000000000000000000000000000000000000" as const;

export interface MintAllocation {
  to: `0x${string}`;
  amount: bigint;
}

/** Sum duplicate recipients — batchMint reverts if the same address appears twice. */
export function mergeMintAllocations(mints: MintAllocation[]): MintAllocation[] {
  const byAddr = new Map<string, bigint>();
  for (const m of mints) {
    if (m.amount <= BigInt(0)) continue;
    const key = m.to.toLowerCase();
    byAddr.set(key, (byAddr.get(key) ?? BigInt(0)) + m.amount);
  }
  return Array.from(byAddr.entries()).map(([to, amount]) => ({
    to: to as `0x${string}`,
    amount,
  }));
}

export interface LaunchB20Params {
  name: string;
  symbol: string;
  creator: `0x${string}`;
  decimals: number;
  supplyCap: bigint;
  /** bytes32 salt — use vanity grind or computeLaunchSalt */
  salt: `0x${string}`;
  /** o1-style: no DEFAULT_ADMIN_ROLE holder */
  adminless?: boolean;
  metadataEditable?: boolean;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  /** Genesis mints via batchMint initCall (factory bootstrap window) */
  mints?: MintAllocation[];
}

export function computeLaunchSalt(
  name: string,
  symbol: string,
  creator: string,
  nonce: string
): `0x${string}` {
  return keccak256(
    toBytes(`${name}:${symbol}:${creator.toLowerCase()}:${nonce}`)
  );
}

export function encodeAssetCreateParams(
  name: string,
  symbol: string,
  initialAdmin: `0x${string}`,
  decimals: number
): Hex {
  // Factory expects abi.encode(B20AssetCreateParams) — a single tuple, not flat head args.
  return encodeAbiParameters(
    parseAbiParameters(
      "(uint8 version, string name, string symbol, address initialAdmin, uint8 decimals)"
    ),
    [
      {
        version: B20_ASSET_CREATE_PARAMS_VERSION,
        name,
        symbol,
        initialAdmin,
        decimals,
      },
    ]
  );
}

function encodeBatchMintInitCall(mints: MintAllocation[]): Hex | null {
  if (mints.length === 0) return null;
  return encodeFunctionData({
    abi: B20_TOKEN_ABI,
    functionName: "batchMint",
    args: [mints.map((m) => m.to), mints.map((m) => m.amount)],
  });
}

export function encodeCreateB20Calldata(params: LaunchB20Params): Hex {
  const admin = params.adminless ? ZERO_ADMIN : params.creator;
  const encodedParams = encodeAssetCreateParams(
    params.name,
    params.symbol,
    admin,
    params.decimals
  );
  const cap = params.supplyCap > BigInt(0) ? params.supplyCap : MAX_SUPPLY_CAP;

  const initCalls: Hex[] = [
    encodeFunctionData({
      abi: B20_TOKEN_ABI,
      functionName: "updateSupplyCap",
      args: [cap],
    }),
  ];

  const batch = encodeBatchMintInitCall(params.mints ?? []);
  if (batch) initCalls.push(batch);

  if (params.metadataEditable) {
    initCalls.push(
      encodeFunctionData({
        abi: B20_TOKEN_ABI,
        functionName: "grantRole",
        args: [METADATA_ROLE, params.creator],
      })
    );
  }

  if (params.description?.trim()) {
    initCalls.push(
      encodeFunctionData({
        abi: B20_TOKEN_ABI,
        functionName: "updateExtraMetadata",
        args: ["description", params.description.trim()],
      })
    );
  }
  if (params.website?.trim()) {
    initCalls.push(
      encodeFunctionData({
        abi: B20_TOKEN_ABI,
        functionName: "updateExtraMetadata",
        args: ["website", params.website.trim()],
      })
    );
  }
  if (params.twitter?.trim()) {
    initCalls.push(
      encodeFunctionData({
        abi: B20_TOKEN_ABI,
        functionName: "updateExtraMetadata",
        args: ["twitter", params.twitter.trim()],
      })
    );
  }
  if (params.telegram?.trim()) {
    initCalls.push(
      encodeFunctionData({
        abi: B20_TOKEN_ABI,
        functionName: "updateExtraMetadata",
        args: ["telegram", params.telegram.trim()],
      })
    );
  }
  if (params.discord?.trim()) {
    initCalls.push(
      encodeFunctionData({
        abi: B20_TOKEN_ABI,
        functionName: "updateExtraMetadata",
        args: ["discord", params.discord.trim()],
      })
    );
  }

  return encodeFunctionData({
    abi: B20_FACTORY_ABI,
    functionName: "createB20",
    args: [B20_VARIANT_ASSET, params.salt, encodedParams, initCalls],
  });
}

export function encodeMintCalldata(
  token: `0x${string}`,
  to: `0x${string}`,
  amount: bigint
): Hex {
  return encodeFunctionData({
    abi: B20_TOKEN_ABI,
    functionName: "mint",
    args: [to, amount],
  });
}

export function encodeErc20TransferCalldata(
  to: `0x${string}`,
  amount: bigint
): Hex {
  return encodeFunctionData({
    abi: B20_TOKEN_ABI,
    functionName: "transfer",
    args: [to, amount],
  });
}

export function encodeB20ApproveCalldata(
  spender: `0x${string}`,
  amount: bigint
): Hex {
  return encodeFunctionData({
    abi: B20_TOKEN_ABI,
    functionName: "approve",
    args: [spender, amount],
  });
}

export async function predictB20Address(
  creator: `0x${string}`,
  salt: `0x${string}`,
  rpcUrl?: string
): Promise<`0x${string}` | null> {
  try {
    const { createPublicClient, http } = await import("viem");
    const { base } = await import("viem/chains");
    const { createPublicOnlyBaseClient } = await import("@/lib/utils/base-rpc");
    const pub = rpcUrl
      ? createPublicClient({ chain: base, transport: http(rpcUrl) })
      : createPublicOnlyBaseClient();
    return await pub.readContract({
      address: B20_FACTORY_ADDRESS,
      abi: B20_FACTORY_ABI,
      functionName: "getB20Address",
      args: [B20_VARIANT_ASSET, creator, salt],
    });
  } catch {
    return null;
  }
}

export {
  B20_FACTORY_ABI,
  B20_FACTORY_ADDRESS,
  B20_TOKEN_ABI,
};
