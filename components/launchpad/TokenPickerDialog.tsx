"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import {
  COMMON_BASE_TOKENS,
  searchCommonTokens,
  type CommonToken,
} from "@/lib/launchpad/common-tokens";
import { resolveTokenByAddress } from "@/lib/api/launchpad-client";

/** Either native ETH or any Base ERC-20. */
export type SwapCounter =
  | { kind: "eth" }
  | {
      kind: "token";
      address: string;
      symbol: string;
      decimals: number;
      imageUrl?: string;
    };

export const ETH_COUNTER: SwapCounter = { kind: "eth" };

export function counterSymbol(counter: SwapCounter): string {
  return counter.kind === "eth" ? "ETH" : counter.symbol;
}

export function counterDecimalsOf(counter: SwapCounter): number {
  return counter.kind === "eth" ? 18 : counter.decimals;
}

export function sameCounter(a: SwapCounter, b: SwapCounter): boolean {
  if (a.kind === "eth" || b.kind === "eth") return a.kind === b.kind;
  return a.address.toLowerCase() === b.address.toLowerCase();
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function CounterAvatar({
  counter,
  size = 28,
}: {
  counter: SwapCounter;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (counter.kind === "eth") {
    return (
      <span className="swap-eth-icon" style={style}>
        Ξ
      </span>
    );
  }
  if (counter.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={counter.imageUrl}
        alt=""
        className="rounded-full object-cover border border-white/10 shrink-0"
        style={style}
      />
    );
  }
  return (
    <span className="swap-eth-icon" style={style}>
      {counter.symbol.slice(0, 2)}
    </span>
  );
}

export default function TokenPickerDialog({
  open,
  onClose,
  onSelect,
  excludeAddress,
  title = "Select a token",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (counter: SwapCounter) => void;
  /** The other side of the pair — hidden so a token can't be swapped for itself. */
  excludeAddress?: string | null;
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<Extract<
    SwapCounter,
    { kind: "token" }
  > | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResolved(null);
    setResolveError(null);
    const id = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const excluded = excludeAddress?.toLowerCase() ?? null;

  const listed = useMemo(() => {
    const matches = searchCommonTokens(query);
    return excluded
      ? matches.filter((t) => t.address.toLowerCase() !== excluded)
      : matches;
  }, [query, excluded]);

  const showEth = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q || "eth".includes(q) || "ethereum".includes(q);
  }, [query]);

  /**
   * A pasted address that isn't on the shortlist still needs to be tradeable,
   * so it gets resolved against the contract itself.
   */
  useEffect(() => {
    const raw = query.trim();
    if (!ADDRESS_RE.test(raw)) {
      setResolved(null);
      setResolveError(null);
      return;
    }
    if (COMMON_BASE_TOKENS.some((t) => t.address.toLowerCase() === raw.toLowerCase())) {
      return;
    }

    let alive = true;
    setResolving(true);
    setResolveError(null);
    void resolveTokenByAddress(raw)
      .then(({ token }) => {
        if (!alive) return;
        if (!token) {
          setResolved(null);
          setResolveError("That address is not an ERC-20 token on Base");
          return;
        }
        setResolved({
          kind: "token",
          address: token.address,
          symbol: token.symbol,
          decimals: token.decimals ?? 18,
          imageUrl: token.imageUrl,
        });
      })
      .catch(() => {
        if (alive) setResolveError("Could not read that contract");
      })
      .finally(() => {
        if (alive) setResolving(false);
      });
    return () => {
      alive = false;
    };
  }, [query]);

  if (!open) return null;

  const pick = (counter: SwapCounter) => {
    onSelect(counter);
    onClose();
  };

  const asCounter = (t: CommonToken): SwapCounter => ({
    kind: "token",
    address: t.address,
    symbol: t.symbol,
    decimals: t.decimals,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />
      <div className="relative w-full sm:max-w-md max-h-[85vh] sm:max-h-[32rem] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-raised)] overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg text-[var(--ink-dim)] hover:text-[var(--ink)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 focus-within:border-[var(--border-focus)] transition-colors">
            <Search size={15} className="text-[var(--ink-dim)] shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or paste address"
              className="flex-1 bg-transparent py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none"
            />
            {resolving && (
              <Loader2 size={14} className="animate-spin text-[var(--ink-dim)] shrink-0" />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {showEth && (
            <TokenRow
              counter={ETH_COUNTER}
              name="Ether"
              onSelect={() => pick(ETH_COUNTER)}
            />
          )}

          {listed.map((t) => (
            <TokenRow
              key={t.address}
              counter={asCounter(t)}
              name={t.name}
              onSelect={() => pick(asCounter(t))}
            />
          ))}

          {resolved && (
            <>
              <p className="px-3 pt-3 pb-1 text-[11px] text-[var(--ink-dim)]">
                Found on-chain
              </p>
              <TokenRow
                counter={resolved}
                name={resolved.address}
                onSelect={() => pick(resolved)}
              />
            </>
          )}

          {!showEth && listed.length === 0 && !resolved && !resolving && (
            <p className="px-3 py-6 text-center text-[13px] text-[var(--ink-dim)]">
              {resolveError ?? "No match. Paste a contract address to trade any Base token."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TokenRow({
  counter,
  name,
  onSelect,
}: {
  counter: SwapCounter;
  name: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-hover)] transition-colors text-left"
    >
      <CounterAvatar counter={counter} size={32} />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-[var(--ink)]">
          {counterSymbol(counter)}
        </span>
        <span className="block text-[12px] text-[var(--ink-dim)] truncate">{name}</span>
      </span>
    </button>
  );
}
