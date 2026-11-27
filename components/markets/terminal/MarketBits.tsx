/** Small pieces shared by the Markets screen and the Home highlights. */
import Link from "next/link";
import TokenLogo from "@/components/ui/TokenLogo";
import { formatPrice } from "@/components/trade/CandleChart";
import type { MarketItem } from "@/lib/markets/board";

export const frame = "rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)]";

export const marketHref = (address: string) => `/explore?pick=${address.toLowerCase()}`;

export const priceText = (p: number | null) => (p === null ? "—" : `$${formatPrice(p)}`);

export const compactUsd = (n: number | null) =>
  n === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);

export function Change({ value, className = "" }: { value: number | null; className?: string }) {
  if (value === null) return <span className={`text-[var(--ink-muted)] ${className}`}>—</span>;
  return (
    <span className={`font-bold ${value >= 0 ? "text-[var(--success-text)]" : "text-[var(--danger-text)]"} ${className}`}>
      {value >= 0 ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

export function Logo({ item, size = 32 }: { item: MarketItem; size?: number }) {
  return <TokenLogo address={item.address} symbol={item.symbol} src={item.iconUrl} size={size} />;
}

/**
 * Opens a market: a button that selects it when already on Markets, otherwise a link there.
 */
export function Pick({ address, onPick, className, children }: { address: string; onPick?: (address: string) => void; className: string; children: React.ReactNode }) {
  return onPick ? (
    <button type="button" onClick={() => onPick(address)} className={`cursor-pointer text-left ${className}`}>
      {children}
    </button>
  ) : (
    <Link href={marketHref(address)} className={className}>
      {children}
    </Link>
  );
}

export function MoverList({ title, icon, items, onPick, empty = "Nothing to show yet." }: { title: string; icon: React.ReactNode; items: MarketItem[]; onPick?: (address: string) => void; empty?: string }) {
  return (
    <section aria-label={title} className={`${frame} p-3`}>
      <h3 className="flex items-center gap-2 px-1 pb-1 text-[15px] font-bold text-[var(--ink)]">
        <span aria-hidden className="text-[var(--brand-text)]">{icon}</span>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="px-1 py-3 text-[13px] text-[var(--ink-muted)]">{empty}</p>
      ) : (
        <ul>
          {items.map((x) => (
            <li key={x.address}>
              <Pick address={x.address} onPick={onPick} className="flex min-h-12 w-full items-center gap-2.5 rounded-2xl px-1.5 py-1.5 hover:bg-[var(--surface-2)]">
                <Logo item={x} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[var(--ink)]">{x.symbol}</span>
                  <span className="block truncate text-[13px] text-[var(--ink-muted)]">{x.name}</span>
                </span>
                <span className="text-right tabular-nums">
                  <span className="block text-sm font-bold text-[var(--ink)]">{priceText(x.priceUsd)}</span>
                  <Change value={x.change24h} className="block text-[13px]" />
                </span>
              </Pick>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
