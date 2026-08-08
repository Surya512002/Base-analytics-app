"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import {
  COMMON_BASE_TOKENS,
  searchCommonTokens,
  type CommonToken,
} from "@/lib/launchpad/common-tokens";
import { resolveTokenByAddress } from "@/lib/api/launchpad-client";
import { commonTokenToCounter, enrichSwapCounter } from "@/lib/launchpad/token-logo";
import TokenIcon from "@/components/swap/TokenIcon";
import type { TokenSearchHit } from "@/lib/launchpad/token-search";

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
  return <TokenIcon counter={counter} size={size} />;
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
  const [searching, setSearching] = useState(false);
  const [searchHits, setSearchHits] = useState<TokenSearchHit[]>([]);
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
    setSearchHits([]);
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
        setResolved(
          enrichSwapCounter({
            kind: "token",
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals ?? 18,
            imageUrl: token.imageUrl,
          }) as Extract<SwapCounter, { kind: "token" }>
        );
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

  /** Name/symbol search via DexScreener so any Base pool token can be found. */
  useEffect(() => {
    const raw = query.trim();
    if (ADDRESS_RE.test(raw) || raw.length < 2) {
      setSearchHits([]);
      setSearching(false);
      return;
    }

    let alive = true;
    setSearching(true);
    const t = window.setTimeout(() => {
      void fetch(`/api/launchpad/search-tokens?q=${encodeURIComponent(raw)}`, {
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((data: { tokens?: TokenSearchHit[] }) => {
          if (!alive) return;
          const hits = (data.tokens ?? []).filter(
            (h) => !excluded || h.address.toLowerCase() !== excluded
          );
          setSearchHits(hits);
        })
        .catch(() => {
          if (alive) setSearchHits([]);
        })
        .finally(() => {
          if (alive) setSearching(false);
        });
    }, 280);

    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [query, excluded]);

  if (!open) return null;

  const pick = (counter: SwapCounter) => {
    onSelect(enrichSwapCounter(counter));
    onClose();
  };

  const asCounter = (t: CommonToken): SwapCounter => commonTokenToCounter(t);

  const hitToCounter = (h: TokenSearchHit): SwapCounter =>
    enrichSwapCounter({
      kind: "token",
      address: h.address,
      symbol: h.symbol,
      decimals: 18,
      imageUrl: h.imageUrl,
    });

  const listedAddrs = new Set(listed.map((t) => t.address.toLowerCase()));
  const extraHits = searchHits.filter((h) => !listedAddrs.has(h.address.toLowerCase()));

  return (
    <div
      className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-0 sm:p-4"
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
              placeholder="Search any Base token or paste 0x address"
              className="flex-1 bg-transparent py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none"
            />
            {(resolving || searching) && (
              <Loader2 size={14} className="animate-spin text-[var(--ink-dim)] shrink-0" />
            )}
          </div>
          <p className="mt-2 text-[11px] text-[var(--ink-dim)] leading-relaxed">
            Majors, Aerodrome pools, airdrops — anything with Base liquidity. Paste the
            contract if search misses it.
          </p>
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

          {extraHits.length > 0 && (
            <>
              <p className="px-3 pt-3 pb-1 text-[11px] text-[var(--ink-dim)]">
                On Base · DexScreener
              </p>
              {extraHits.map((h) => {
                const fallback = hitToCounter(h);
                return (
                  <TokenRow
                    key={h.address}
                    counter={fallback}
                    name={h.name}
                    subtitle={
                      h.liquidityUsd > 0
                        ? `Liq $${Math.round(h.liquidityUsd).toLocaleString()}`
                        : undefined
                    }
                    onSelect={() => {
                      // Resolve decimals on-chain before trading (many airdrops aren't 18).
                      void resolveTokenByAddress(h.address)
                        .then(({ token }) => {
                          if (token) {
                            pick({
                              kind: "token",
                              address: token.address,
                              symbol: token.symbol || h.symbol,
                              decimals: token.decimals ?? 18,
                              imageUrl: token.imageUrl ?? h.imageUrl,
                            });
                          } else {
                            pick(fallback);
                          }
                        })
                        .catch(() => pick(fallback));
                    }}
                  />
                );
              })}
            </>
          )}

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

          {!showEth &&
            listed.length === 0 &&
            extraHits.length === 0 &&
            !resolved &&
            !resolving &&
            !searching && (
              <p className="px-3 py-6 text-center text-[13px] text-[var(--ink-dim)]">
                {resolveError ??
                  "No match. Paste the token contract address (0x…) to trade any Base ERC-20."}
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
  subtitle,
  onSelect,
}: {
  counter: SwapCounter;
  name: string;
  subtitle?: string;
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
        <span className="block text-[12px] text-[var(--ink-dim)] truncate">
          {subtitle ?? name}
        </span>
      </span>
    </button>
  );
}
