"use client";

import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { resolveTokenByAddress } from "@/lib/api/launchpad-client";

export default function ImportTokenBar({
  onResolved,
  onError,
}: {
  onResolved: (token: LaunchedToken) => void;
  onError?: (msg: string) => void;
}) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const raw = address.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) {
      onError?.("Paste a valid Base contract address (0x…)");
      return;
    }
    setLoading(true);
    try {
      const { token } = await resolveTokenByAddress(raw);
      if (!token) {
        onError?.("That address is not an ERC-20 token on Base");
        return;
      }
      onResolved(token);
      setAddress("");
    } catch {
      onError?.("Could not load token — try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-raised)] p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Search size={14} className="text-[var(--ink-dim)]" />
        <p className="text-[13px] font-semibold text-[var(--ink)]">Trade any Base token</p>
      </div>
      <p className="text-[12px] text-[var(--ink-dim)] mb-3 leading-relaxed">
        Paste any Base contract address — we&apos;ll read it on-chain and route the swap
        across Uniswap, Aerodrome and 0x.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="0x… contract address"
          className="flex-1 input-ink rounded-lg px-3 py-2.5 text-[13px] font-mono"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void submit()}
          className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading…" : "Trade"}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
