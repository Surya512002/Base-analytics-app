export type X402ProductId = "scan" | "export" | "compare" | "farcaster";

export interface X402Product {
  id: X402ProductId;
  label: string;
  amountUsdc: string;
  amountLabel: string;
  priceDisplay: string;
  description: string;
  highlight?: string;
}

/** Amounts in USDC base units (6 decimals). */
export const X402_PRODUCTS: X402Product[] = [
  {
    id: "scan",
    label: "Deep Scan",
    amountUsdc: "10000",
    amountLabel: "0.01 USDC",
    priceDisplay: "$0.01",
    description: "Premium insights, portfolio breakdown & benchmarks",
  },
  {
    id: "export",
    label: "Export Pack",
    amountUsdc: "50000",
    amountLabel: "0.05 USDC",
    priceDisplay: "$0.05",
    description: "Full scan + downloadable activity report",
    highlight: "Popular",
  },
  {
    id: "compare",
    label: "Compare Pro",
    amountUsdc: "100000",
    amountLabel: "0.10 USDC",
    priceDisplay: "$0.10",
    description: "Full benchmarks vs Base median + export",
    highlight: "Pro",
  },
  {
    id: "farcaster",
    label: "Farcaster Analysis",
    amountUsdc: "100000",
    amountLabel: "0.10 USDC",
    priceDisplay: "$0.10",
    description: "Unlock linked Farcaster identity & full cast analytics",
  },
];

export function getX402Product(id: X402ProductId): X402Product {
  return X402_PRODUCTS.find((p) => p.id === id) ?? X402_PRODUCTS[0];
}

export function productIdFromAmount(amount: string | undefined): X402ProductId {
  if (!amount) return "scan";
  const match = X402_PRODUCTS.find((p) => p.amountUsdc === amount);
  return match?.id ?? "scan";
}
