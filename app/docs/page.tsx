import type { Metadata } from "next";
import { getAppUrl, appOgImage } from "@/lib/constants/app-url";
import DocumentsClient from "@/components/docs/DocumentsClient";

const appUrl = getAppUrl();
const ogImage = appOgImage();

export const metadata: Metadata = {
  title: "Documents & Developer API — Base Terminal",
  description:
    "Comprehensive guides, protocol architecture, Model Context Protocol (MCP) tools, verified smart contracts, and public REST APIs for trading tokenized equities, multi-DEX swaps, token launches, lending comparisons, and crypto vouchers on Base mainnet.",
  openGraph: {
    title: "Base Terminal Documents & Developer Portal",
    description:
      "Explore guides, public REST endpoints, Model Context Protocol (MCP) agent tools, and smart contracts on Base mainnet.",
    url: `${appUrl}/docs`,
    images: [{ url: ogImage, width: 1200, height: 630, alt: "Base Terminal Documents" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Base Terminal Documents & Developer Portal",
    description:
      "Explore guides, public REST endpoints, Model Context Protocol (MCP) agent tools, and smart contracts on Base mainnet.",
    images: [ogImage],
  },
  alternates: { canonical: `${appUrl}/docs` },
};

export default function DocumentsPage() {
  return (
    <>
      <div className="sr-only" aria-hidden={false}>
        <h1>Base Terminal Documents, Developer Guides and Public API</h1>
        <p>
          Documentation portal for Base Terminal: Coinbase Tokenized Stocks (NVDAc, AAPLc, TSLAc, COINc),
          smart DEX routing across Uniswap v3, Aerodrome, and 0x with creator revenue sharing, 3-mode token
          launchpad (B20 vanity, ERC-20 meme coins, stock-paired memestocks), lending comparisons across
          Morpho Blue and Aave v3 with Collateral Health Factor Simulator, and Base Voucher gift cards.
        </p>
      </div>
      <DocumentsClient />
    </>
  );
}
