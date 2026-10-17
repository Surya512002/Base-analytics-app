import type { AppTab } from "@/hooks/useWalletApp";

export type AgentCatalogEntry = {
  id: string;
  title: string;
  description: string;
  price: string;
  tab?: AppTab;
  href?: string;
  tag?: string;
};

export const AGENT_CATALOG: AgentCatalogEntry[] = [
  {
    id: "launch-assistant",
    title: "Token Launchpad",
    description: "Launch B20, meme, or stock-paired tokens with 0.25% creator fee splits",
    price: "$0 launch",
    tab: "launchpad",
    tag: "Launch",
  },
  {
    id: "stocks-terminal",
    title: "Stocks & Lending",
    description: "Tokenized NVDAc, AAPLc, TSLAc & Morpho/Aave yield comparisons",
    price: "Free",
    tab: "lend",
    tag: "Stocks",
  },
  {
    id: "dex-router",
    title: "Smart DEX Swap",
    description: "Dual-DEX Uniswap & Aerodrome aggregator with optimal slippage",
    price: "DEX Gas",
    tab: "swap",
    tag: "Trade",
  },
  {
    id: "voucher-mcp",
    title: "Voucher MCP Agent",
    description: "Create & redeem onchain USDC/ETH crypto gift cards programmatically",
    price: "Gas only",
    tab: "basehub",
    href: "/docs#api",
    tag: "MCP",
  },
];
