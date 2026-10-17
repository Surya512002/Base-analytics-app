/** Parse human supply labels like "1B", "1000000000", "500M". */
export function parseSupplyCap(raw?: string): number {
  if (!raw) return 1_000_000_000;
  const s = raw.trim().toUpperCase();
  const m = s.match(/^([\d.]+)\s*([KMB])?$/);
  if (!m) {
    const n = parseFloat(s.replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 1_000_000_000;
  }
  const base = parseFloat(m[1]);
  if (!Number.isFinite(base) || base <= 0) return 1_000_000_000;
  const suffix = m[2];
  if (suffix === "K") return base * 1_000;
  if (suffix === "M") return base * 1_000_000;
  if (suffix === "B") return base * 1_000_000_000;
  return base;
}

import { formatUnits } from "viem";

export function formatCompact(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(digits)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(digits)}K`;
  if (abs >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: digits });
  return n.toFixed(digits);
}

/** Formats token amounts without scientific notation, with commas or K/M/B abbreviations where appropriate. */
export function formatTokenAmount(
  amount: bigint | string | number | null | undefined,
  decimals = 18
): string {
  if (amount == null) return "0";
  let n: number;

  if (typeof amount === "bigint") {
    const dec = Number.isFinite(decimals) && decimals >= 0 ? decimals : 18;
    const humanStr = formatUnits(amount, dec);
    n = parseFloat(humanStr);
  } else if (typeof amount === "string") {
    const trimmed = amount.trim();
    if (!trimmed || trimmed === "0") return "0";
    if (/^\d+$/.test(trimmed)) {
      // Raw integer/wei string: convert safely with formatUnits to avoid float overflow
      const dec = Number.isFinite(decimals) && decimals >= 0 ? decimals : 18;
      try {
        n = parseFloat(formatUnits(BigInt(trimmed), dec));
      } catch {
        n = parseFloat(trimmed);
      }
    } else {
      n = parseFloat(trimmed);
    }
  } else {
    n = amount;
  }

  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(2)}K`;
  if (n >= 1) {
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }
  if (n >= 0.0001) {
    return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  }
  // Small token amounts: display clean decimal places, never scientific notation
  const s = n.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  return s === "0" ? "<0.00000001" : s;
}

export function formatUsd(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n <= 0) return "$0.00";
  // Small USD numbers: format with subscript or clean decimals, never scientific notation
  return formatSubscriptPrice(n);
}

export function formatEth(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  if (n >= 1) return `${n.toFixed(4)} ETH`;
  if (n >= 0.0001) return `${n.toFixed(6)} ETH`;
  if (n <= 0) return "0 ETH";
  const s = n.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  return `${s === "0" ? "<0.00000001" : s} ETH`;
}

export function formatSubscriptPrice(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "—";
  if (usd >= 0.01) return `$${usd.toFixed(4)}`;
  const str = usd.toFixed(14);
  const match = str.match(/^0\.(0+)(\d{2,6})/);
  if (!match) {
    const fallback = usd.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
    return `$${fallback === "0" ? "<0.00000001" : fallback}`;
  }
  const zeros = match[1].length;
  const sig = match[2];
  const sub = String(zeros)
    .split("")
    .map((d) => String.fromCharCode(0x2080 + parseInt(d, 10)))
    .join("");
  return `$0.0${sub}${sig}`;
}

export function timeAgo(tsSec: number | null | undefined): string {
  if (!tsSec) return "—";
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - tsSec);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function shortAddr(a: string, head = 6, tail = 4): string {
  if (!a || a.length < head + tail + 2) return a || "—";
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}

export function createdAgo(createdAt: number): string {
  return timeAgo(Math.floor(createdAt / 1000));
}
