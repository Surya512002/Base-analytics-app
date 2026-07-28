import type { X402ProductId } from "@/lib/constants/x402-products";

export type AgentCatalogEntry = {
  id: string;
  title: string;
  description: string;
  price: string;
  productId?: X402ProductId;
  tab?: "dashboard" | "launchpad" | "basehub";
  href?: string;
  tag?: string;
};

export const AGENT_CATALOG: AgentCatalogEntry[] = [
  {
    id: "deep-scan",
    title: "Wallet Deep Scan",
    description: "Premium onchain insights, portfolio breakdown & benchmarks",
    price: "$0.01",
    productId: "scan",
    tab: "dashboard",
    tag: "x402",
  },
  {
    id: "export-pack",
    title: "Export Pack",
    description: "Full scan + downloadable activity report",
    price: "$0.05",
    productId: "export",
    tab: "dashboard",
    tag: "Popular",
  },
  {
    id: "compare-pro",
    title: "Compare Pro",
    description: "Benchmarks vs Base median + export",
    price: "$0.10",
    productId: "compare",
    tab: "dashboard",
    tag: "Pro",
  },
  {
    id: "farcaster",
    title: "Farcaster Analysis",
    description: "Linked Farcaster identity & cast analytics",
    price: "$0.10",
    productId: "farcaster",
    tab: "dashboard",
    tag: "Social",
  },
  {
    id: "onchain-analytics",
    title: "Onchain Analytics",
    description: "Score, activity heatmap & wallet health status",
    price: "$0.10",
    productId: "analytics",
    tab: "dashboard",
    tag: "Core",
  },
  {
    id: "voucher-mcp",
    title: "Voucher MCP",
    description: "Create & redeem gift cards via agents",
    price: "Gas only",
    href: "/docs#api",
    tag: "MCP",
  },
  {
    id: "launch-assistant",
    title: "Launch Assistant",
    description: "B20 token deploy on Base with vesting & anti-snipe",
    price: "$0 launch",
    tab: "launchpad",
    tag: "Launch",
  },
];
