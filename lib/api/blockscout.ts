import { formatEther } from "ethers";
import type {
  AlchemyTransfer,
  BlockscoutInternalTx,
  BlockscoutTx,
} from "@/lib/types/wallet";

export async function fetchBlockscoutTxs(
  address: string
): Promise<AlchemyTransfer[]> {
  try {
    const r = await fetch(
      `https://base.blockscout.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&sort=desc`
    );
    const data = await r.json();
    if (!data.result || !Array.isArray(data.result)) return [];
    return (data.result as BlockscoutTx[]).map(
      (tx): AlchemyTransfer => ({
        hash: tx.hash,
        category: "external",
        value: tx.value ? parseFloat(formatEther(tx.value)) : 0,
        asset: "ETH",
        to: tx.to,
        from: tx.from,
        metadata: {
          blockTimestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
        },
      })
    );
  } catch {
    return [];
  }
}

export async function fetchBlockscoutInternalTxs(
  address: string
): Promise<AlchemyTransfer[]> {
  try {
    const r = await fetch(
      `https://base.blockscout.com/api?module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&sort=desc`
    );
    const d = await r.json();
    if (!d.result || !Array.isArray(d.result)) return [];
    return (d.result as BlockscoutInternalTx[]).map(
      (tx): AlchemyTransfer => ({
        hash: tx.hash,
        category: "internal",
        value: tx.value ? parseFloat(formatEther(tx.value)) : 0,
        asset: "ETH",
        to: tx.to,
        from: tx.from,
        metadata: {
          blockTimestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
        },
      })
    );
  } catch {
    return [];
  }
}
