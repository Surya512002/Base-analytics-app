"use client";

import { useEffect, useState } from "react";
import { createBatchedBaseReadClient } from "@/lib/utils/base-rpc";
import { UI_MULTIPLIER_ABI, shareCountLabel } from "@/lib/stocks/share-count";

let client: ReturnType<typeof createBatchedBaseReadClient> | null = null;
const cache = new Map<string, Promise<bigint>>();

function readMultiplier(token: `0x${string}`): Promise<bigint> {
  const key = token.toLowerCase();
  let read = cache.get(key);
  if (!read) {
    client ??= createBatchedBaseReadClient();
    read = client.readContract({ address: token, abi: UI_MULTIPLIER_ABI, functionName: "uiMultiplier" });
    read.catch(() => cache.delete(key));
    cache.set(key, read);
  }
  return read;
}

/**
 * The real share count behind an amount of stock tokens, read from the token itself.
 * Renders nothing until the read succeeds, so a failed read never shows an assumed number.
 */
export default function ShareCount({ token, tokens, prefix, className }: { token?: `0x${string}`; tokens: number; prefix?: string; className?: string }) {
  const [read, setRead] = useState<{ token: string; multiplier: bigint } | null>(null);
  const wanted = tokens > 0 ? token : undefined;

  useEffect(() => {
    if (!wanted) return;
    let live = true;
    let timer: number | undefined;
    // A busy public endpoint can refuse a read, so try a few more times before giving up.
    const attempt = (retries: number) =>
      readMultiplier(wanted)
        .then((multiplier) => live && setRead({ token: wanted, multiplier }))
        .catch(() => {
          if (live && retries > 0) timer = window.setTimeout(() => attempt(retries - 1), 5000);
        });
    void attempt(3);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [wanted]);

  const label = wanted && read?.token === wanted ? shareCountLabel(tokens, read.multiplier) : null;
  return label ? (
    <span className={className}>
      {prefix}
      {label}
    </span>
  ) : null;
}
