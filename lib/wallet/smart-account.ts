import { getAddress } from "viem";

const BLOCKSCOUT_V2 = "https://base.blockscout.com/api/v2";

export interface SmartAccountInfo {
  isSmartAccount: boolean;
  isEip7702: boolean;
  proxyType: string | null;
  tokenTransferCount: number;
  transactionCount: number;
}

export type CollectionDepth = "quick" | "connect" | "complete";

export interface WalletCollectionProfile {
  v2: {
    tokenPages: number;
    internalPages: number;
    externalPages: number;
    deadlineMs: number;
    sequentialStreams: boolean;
  };
  userOps: {
    timeoutMs: number;
    maxChunks: number;
  };
  alchemyPages: number;
}

const QUICK_EOA_PROFILE: WalletCollectionProfile = {
  v2: {
    tokenPages: 3,
    internalPages: 2,
    externalPages: 2,
    deadlineMs: 10_000,
    sequentialStreams: false,
  },
  userOps: { timeoutMs: 4_000, maxChunks: 6 },
  alchemyPages: 4,
};

const QUICK_SMART_PROFILE: WalletCollectionProfile = {
  v2: {
    tokenPages: 4,
    internalPages: 4,
    externalPages: 6,
    deadlineMs: 10_000,
    sequentialStreams: false,
  },
  userOps: { timeoutMs: 4_000, maxChunks: 6 },
  alchemyPages: 4,
};

const EOA_PROFILE: WalletCollectionProfile = {
  v2: {
    tokenPages: 10,
    internalPages: 5,
    externalPages: 6,
    deadlineMs: 16_000,
    sequentialStreams: false,
  },
  userOps: { timeoutMs: 18_000, maxChunks: 24 },
  alchemyPages: 12,
};

const SMART_ACCOUNT_PROFILE: WalletCollectionProfile = {
  v2: {
    tokenPages: 22,
    internalPages: 22,
    externalPages: 55,
    deadlineMs: 24_000,
    sequentialStreams: false,
  },
  userOps: { timeoutMs: 20_000, maxChunks: 28 },
  alchemyPages: 0,
};

const COMPLETE_PROFILE: WalletCollectionProfile = {
  v2: {
    tokenPages: 150,
    internalPages: 100,
    externalPages: 80,
    deadlineMs: 0,
    sequentialStreams: false,
  },
  userOps: { timeoutMs: 120_000, maxChunks: 100 },
  alchemyPages: 18,
};

/** Detect Base App / EIP-7702 smart accounts via Blockscout. */
export async function detectSmartAccount(
  address: string
): Promise<SmartAccountInfo> {
  const fallback: SmartAccountInfo = {
    isSmartAccount: false,
    isEip7702: false,
    proxyType: null,
    tokenTransferCount: 0,
    transactionCount: 0,
  };

  try {
    const pathAddr = getAddress(address);
    const [infoRes, counterRes] = await Promise.all([
      fetch(`${BLOCKSCOUT_V2}/addresses/${pathAddr}`, {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8_000),
      }),
      fetch(`${BLOCKSCOUT_V2}/addresses/${pathAddr}/counters`, {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8_000),
      }),
    ]);

    if (!infoRes.ok) return fallback;

    const info = (await infoRes.json()) as {
      is_contract?: boolean;
      proxy_type?: string | null;
    };
    const counters = counterRes.ok
      ? ((await counterRes.json()) as {
          token_transfers_count?: string;
          transactions_count?: string;
        })
      : {};

    const proxyType = info.proxy_type ?? null;
    const isEip7702 = proxyType === "eip7702";
    const isSmartAccount = Boolean(info.is_contract) || isEip7702;

    return {
      isSmartAccount,
      isEip7702,
      proxyType,
      tokenTransferCount: Number(counters.token_transfers_count || 0),
      transactionCount: Number(counters.transactions_count || 0),
    };
  } catch {
    return fallback;
  }
}

export function collectionProfileForAccount(
  info: SmartAccountInfo,
  depth: CollectionDepth = "connect"
): WalletCollectionProfile {
  if (depth === "complete") return COMPLETE_PROFILE;
  if (depth === "quick") {
    if (info.isSmartAccount || info.isEip7702) return QUICK_SMART_PROFILE;
    if (info.tokenTransferCount > 2000 || info.transactionCount > 1500) {
      return QUICK_SMART_PROFILE;
    }
    return QUICK_EOA_PROFILE;
  }
  if (info.isSmartAccount || info.isEip7702) return SMART_ACCOUNT_PROFILE;
  if (info.tokenTransferCount > 2000 || info.transactionCount > 1500) {
    return SMART_ACCOUNT_PROFILE;
  }
  return EOA_PROFILE;
}

export { QUICK_SMART_PROFILE };
