"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  BookOpen,
  Gift,
  Shield,
  Zap,
  TrendingUp,
  Coins,
  Cpu,
  Search,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  Terminal,
  Compass,
  Repeat,
  Scale,
  Sparkles,
  ArrowUpRight,
  Code2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import AppFooterNav from "@/components/wallet/AppFooterNav";
import { APP_URL_WEB, BUILDER_CODE } from "@/lib/constants/env";

type DocTab =
  | "all"
  | "overview"
  | "compliance"
  | "stocks"
  | "swap"
  | "launchpad"
  | "lend"
  | "vouchers"
  | "mcp"
  | "api"
  | "contracts"
  | "faq";

interface ApiEndpoint {
  id: string;
  method: "GET" | "POST";
  path: string;
  category: "markets" | "launchpad" | "vouchers" | "mcp" | "creator" | "system" | "compliance";
  title: string;
  description: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  exampleCurl: string;
  exampleResponse: string;
}

const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: "stocks",
    method: "GET",
    path: "/api/stocks",
    category: "markets",
    title: "Coinbase Tokenized Stocks Feed",
    description:
      "Fetches real-time prices, 24h trading volume, NAV, and reference market data for Coinbase tokenized equities on Base (NVDAc, AAPLc, TSLAc, COINc, GOOGLc, MSFTc, AMZNc).",
    params: [
      { name: "category", type: "string", required: false, description: "Filter category (e.g. 'all', 'tech', 'etf')" },
      { name: "query", type: "string", required: false, description: "Case-insensitive ticker or symbol search" },
      { name: "sort", type: "string", required: false, description: "Sort by 'volume' | 'gainers' | 'mcap' | 'nav'" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 100)" },
      { name: "page_token", type: "string", required: false, description: "Cursor for pagination" },
      { name: "refresh", type: "string", required: false, description: "Set to '1' to bypass cache and force fresh data" },
    ],
    exampleCurl: "curl -X GET 'https://base-analytics-app.vercel.app/api/stocks?sort=volume&limit=10'",
    exampleResponse: JSON.stringify(
      {
        stocks: [
          {
            symbol: "NVDAc",
            name: "NVIDIA Corp (Tokenized)",
            address: "0x1234...NVDA",
            priceUsd: 138.25,
            nav: 138.2,
            change24h: 3.42,
            volume24hUsd: 1850000,
            mcapUsd: 42000000,
            category: "tech",
          },
        ],
        total: 24,
        next_page_token: "10",
        has_more: true,
        timestamp: 1730000000000,
      },
      null,
      2
    ),
  },
  {
    id: "markets-lending",
    method: "GET",
    path: "/api/markets/lending",
    category: "markets",
    title: "Lending & Borrowing Yields",
    description:
      "Aggregates collateral requirements, supply APYs, borrow APYs, utilization rates, and TVLs across Morpho Blue, Aave v3, Euler, and Superform on Base.",
    params: [
      { name: "category", type: "string", required: false, description: "Filter by 'all', 'lending', or 'supervaults'" },
      { name: "protocol", type: "string", required: false, description: "Filter by 'morpho', 'aave', 'superform', or 'all'" },
      { name: "stocks", type: "boolean", required: false, description: "Set to 'true' to only view stock-focused vaults" },
    ],
    exampleCurl: "curl -X GET 'https://base-analytics-app.vercel.app/api/markets/lending?protocol=morpho'",
    exampleResponse: JSON.stringify(
      {
        markets: [
          {
            id: "morpho-nvdac",
            protocol: "Morpho Blue",
            asset: "NVDAc",
            collateralAsset: "USDC",
            supplyApy: 8.45,
            borrowApy: 11.2,
            maxLtv: 77.0,
            tvlUsd: 6400000,
            isStockFocus: true,
          },
        ],
        summary: {
          totalMarkets: 18,
          stockMarketsCount: 6,
          totalTvlUsd: 48500000,
          builderCode: BUILDER_CODE,
          network: "Base Mainnet (8453)",
        },
      },
      null,
      2
    ),
  },
  {
    id: "launchpad-market",
    method: "GET",
    path: "/api/launchpad/market",
    category: "launchpad",
    title: "Launchpad Global Market Stats",
    description:
      "Returns aggregate launchpad volume, market cap, total tokens launched, fee distributions, and top performers across Base Terminal.",
    params: [],
    exampleCurl: "curl -X GET 'https://base-analytics-app.vercel.app/api/launchpad/market'",
    exampleResponse: JSON.stringify(
      {
        totalTokens: 142,
        totalVolumeUsd: 12450000,
        totalMcapUsd: 38900000,
        volume24hUsd: 980000,
        creatorFeesDistributedUsd: 31125,
        timestamp: 1730000000000,
      },
      null,
      2
    ),
  },
  {
    id: "launchpad-tokens",
    method: "GET",
    path: "/api/launchpad/tokens",
    category: "launchpad",
    title: "List Launched Tokens",
    description:
      "Query deployed tokens with support for keyword search, pagination, creator address filtering, and token type (B20, Meme, Stock-Paired).",
    params: [
      { name: "q", type: "string", required: false, description: "Search by token symbol or name" },
      { name: "creator", type: "string", required: false, description: "Filter by creator wallet 0x..." },
      { name: "limit", type: "number", required: false, description: "Number of tokens per page (default: 20)" },
      { name: "cursor", type: "string", required: false, description: "Cursor for pagination" },
    ],
    exampleCurl: "curl -X GET 'https://base-analytics-app.vercel.app/api/launchpad/tokens?limit=10'",
    exampleResponse: JSON.stringify(
      {
        tokens: [
          {
            address: "0xB200a7b483B6F67D4fC4b24894e0341773099",
            name: "Base Alpha",
            symbol: "BALPHA",
            launchType: "b20_vanity",
            quoteToken: "USDC",
            creator: "0x3344...8899",
            totalSupply: "1000000000",
            marketCapUsd: 142000,
            volume24hUsd: 48500,
            createdAt: 1729000000000,
          },
        ],
        cursor: "10",
        hasMore: true,
      },
      null,
      2
    ),
  },
  {
    id: "launchpad-quote",
    method: "GET",
    path: "/api/launchpad/quote",
    category: "launchpad",
    title: "Smart Multi-DEX Swap Quote",
    description:
      "Calculates quotes across Uniswap v3, Aerodrome, Slipstream, and 0x API with creator fee breakdown (0.25%), slippage protection, and price impact.",
    params: [
      { name: "sellToken", type: "string", required: true, description: "Address or ticker of token to sell" },
      { name: "buyToken", type: "string", required: true, description: "Address or ticker of token to buy" },
      { name: "amountIn", type: "string", required: true, description: "Input amount in base units (wei / token decimals)" },
      { name: "slippageBps", type: "number", required: false, description: "Slippage tolerance in bps (default: 50 = 0.5%)" },
      { name: "dex", type: "string", required: false, description: "Target DEX: 'auto' | 'uniswap' | 'aerodrome' | 'slipstream' | 'o1'" },
      { name: "taker", type: "string", required: false, description: "User wallet address for exact approval checks" },
    ],
    exampleCurl:
      "curl -X GET 'https://base-analytics-app.vercel.app/api/launchpad/quote?sellToken=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&buyToken=0x4200000000000000000000000000000000000006&amountIn=100000000'",
    exampleResponse: JSON.stringify(
      {
        bestDex: "aerodrome",
        amountIn: "100000000",
        amountOut: "31850000000000000",
        amountOutMinimum: "31690000000000000",
        priceImpactBps: 12,
        creatorFee: {
          bps: 25,
          amount: "250000",
          recipient: "0xCreatorWallet...",
        },
        platformFee: {
          bps: 25,
          amount: "250000",
        },
      },
      null,
      2
    ),
  },
  {
    id: "launchpad-activity",
    method: "GET",
    path: "/api/launchpad/activity",
    category: "launchpad",
    title: "Live Activity & Trade Stream",
    description:
      "Chronological live feed of token launches, liquidity additions, and swap executions across all Base Terminal tokens.",
    params: [
      { name: "limit", type: "number", required: false, description: "Number of events (default: 50)" },
      { name: "token", type: "string", required: false, description: "Filter by specific token address" },
    ],
    exampleCurl: "curl -X GET 'https://base-analytics-app.vercel.app/api/launchpad/activity?limit=15'",
    exampleResponse: JSON.stringify(
      {
        activity: [
          {
            type: "swap",
            txHash: "0xabc...def",
            tokenAddress: "0xB200a7b483B6F67D4fC4b24894e0341773099",
            tokenSymbol: "BALPHA",
            side: "buy",
            amountTokens: "15000",
            amountUsd: 213.5,
            maker: "0xUser...",
            timestamp: 1730000000000,
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: "voucher-preview",
    method: "GET",
    path: "/api/voucher/card-preview",
    category: "vouchers",
    title: "Voucher Card Preview",
    description:
      "Public metadata lookup for a gift card using Card ID (batchId-cardIndex) to display card design, asset type, and redemption status without exposing the secret.",
    params: [
      { name: "card", type: "string", required: true, description: "Card ID in format 'batchId-cardIndex' (e.g. '12-3')" },
    ],
    exampleCurl: "curl -X GET 'https://base-analytics-app.vercel.app/api/voucher/card-preview?card=12-3'",
    exampleResponse: JSON.stringify(
      {
        cardId: "12-3",
        batchId: 12,
        cardIndex: 3,
        asset: "USDC",
        amountFormatted: "$10.00 USDC",
        amountBase: "10000000",
        isRedeemed: false,
        creator: "0xCreator...",
        message: "Happy Launch Day!",
        createdAt: 1729000000000,
      },
      null,
      2
    ),
  },
  {
    id: "mcp-api",
    method: "POST",
    path: "/api/mcp",
    category: "mcp",
    title: "Model Context Protocol (MCP) Server",
    description:
      "JSON-RPC 2.0 endpoint implementing Model Context Protocol for autonomous AI agents (Claude Desktop, Cursor, OpenAI GPTs, Base MCP) to prepare batches, look up status, and redeem cards.",
    params: [
      { name: "method", type: "string", required: true, description: "MCP method: 'tools/list' or 'tools/call'" },
      { name: "params", type: "object", required: true, description: "Tool name and arguments object" },
    ],
    exampleCurl: `curl -X POST 'https://base-analytics-app.vercel.app/api/mcp' \\
  -H 'Content-Type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"voucher_lookup_batch","arguments":{"batchId":12}}}'`,
    exampleResponse: JSON.stringify(
      {
        jsonrpc: "2.0",
        id: 1,
        result: {
          batchId: 12,
          creator: "0xCreator...",
          asset: "USDC",
          cardCount: 10,
          redeemedCount: 4,
          unredeemedCount: 6,
          amountPerCard: "10000000",
          amountPerCardFormatted: "$10.00 USDC",
          message: "Gift for hackathon winners",
        },
      },
      null,
      2
    ),
  },
  {
    id: "creator-profile",
    method: "GET",
    path: "/api/creator/[address]",
    category: "creator",
    title: "Creator Analytics & Profile",
    description:
      "Fetches creator profile data, list of tokens deployed, aggregate volume driven, fee earnings, and verified onchain builder attribution.",
    params: [
      { name: "address", type: "string", required: true, description: "Creator wallet address (0x...)" },
    ],
    exampleCurl: "curl -X GET 'https://base-analytics-app.vercel.app/api/creator/0x33445566778899aabbccddeeff00112233445566'",
    exampleResponse: JSON.stringify(
      {
        address: "0x3344...5566",
        displayName: "BaseBuilder",
        bio: "Launching high-liquidity stock memecoins on Base",
        tokensDeployed: 3,
        totalVolumeUsd: 1450000,
        totalFeesEarnedUsd: 3625,
        tokens: [
          {
            address: "0xB200...",
            symbol: "NVDAX",
            volumeUsd: 980000,
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: "compliance-status",
    method: "GET",
    path: "/api/compliance/status",
    category: "compliance",
    title: "Compliance Status & Edge Geo-Gating",
    description:
      "Returns server-verified visitor compliance state evaluated at Vercel's edge network, including ISO country code, active region mode ('full' | 'exit-only' | 'blocked'), global kill switch state, and active feature flags.",
    params: [],
    exampleCurl: "curl -X GET 'https://base-analytics-app.vercel.app/api/compliance/status'",
    exampleResponse: JSON.stringify(
      {
        country: "DE",
        isRestricted: false,
        mode: "full",
        canEnter: true,
        canExit: true,
        globalKillSwitch: false,
        features: {
          "stocks.swap": true,
          "stocks.lend": true,
          "stocks.launchPairs": true,
          "stocks.vouchers": true,
        },
        notice: "Availability of tokenized stocks may depend on your location and the issuer's terms.",
        issuerTermsUrl: "https://www.coinbase.com/legal/tokenized-stocks",
        acknowledgementVersion: "1.0",
      },
      null,
      2
    ),
  },
  {
    id: "health",
    method: "GET",
    path: "/api/health",
    category: "system",
    title: "System Health & RPC Latency",
    description:
      "Checks application status, Redis cache latency, Base RPC block height, and aggregator connectivity.",
    params: [],
    exampleCurl: "curl -X GET 'https://base-analytics-app.vercel.app/api/health'",
    exampleResponse: JSON.stringify(
      {
        ok: true,
        network: "base",
        chainId: 8453,
        rpcBlockNumber: 22105432,
        redisConnected: true,
        timestamp: 1730000000000,
      },
      null,
      2
    ),
  },
];

const CONTRACTS_LIST = [
  {
    name: "Base Voucher Protocol",
    description: "Multi-asset crypto gift card protocol. Supports native ETH, USDC, Tokenized Stocks, and Yield Vault shares.",
    address: process.env.NEXT_PUBLIC_VOUCHER_CONTRACT || "Configured via NEXT_PUBLIC_VOUCHER_CONTRACT",
    standard: "Custom Multi-Token Voucher",
    verified: true,
    features: ["Batch splitting (up to 50 cards)", "Keccak256 secret verification", "One card per wallet rate limit"],
  },
  {
    name: "Achievements Registry",
    description: "Soulbound and tradeable achievement badges representing verified onchain Base milestones and tier unlocks.",
    address: "0xadb8120B4B18b892cFAD171243074487122Dea03",
    standard: "ERC-1155 Multi-Token",
    verified: true,
    features: ["Gasless paymaster mints", "Batch achievement claiming", "Tier progression tracking"],
  },
  {
    name: "Daily Check-In",
    description: "Onchain daily activity streak counter and points registry rewarded with streak multipliers.",
    address: "0xABc7099C631E18640ea60b25116407aa17354FBb",
    standard: "Custom Streak Registry",
    verified: true,
    features: ["Daily streak maintenance", "Base Activity Score booster", "Anti-abuse cooldowns"],
  },
  {
    name: "Booster Contract",
    description: "Onchain interactive XP and transaction multiplier module.",
    address: "0x0d1BE33F8B6a33BeEe7b3bb834DF6f8c168B2e46",
    standard: "Custom Utility",
    verified: true,
    features: ["XP bonus multipliers", "Protocol engagement boost"],
  },
  {
    name: "GM / GN Social Contract",
    description: "Lightweight decentralized greeting contract capturing social provenance on Base.",
    address: "0xdb4f873B33F448aeA8Bb2b3B7e3ab9561329608A",
    standard: "Custom Social",
    verified: true,
    features: ["Decentralized GM / GN logging", "Social activity scoring"],
  },
  {
    name: "Base L1 ↔ L2 Standard Bridge",
    description: "Official canonical Base native asset bridge connecting Ethereum L1 and Base L2.",
    address: "0x4200000000000000000000000000000000000010",
    standard: "Optimism Predeploy",
    verified: true,
    features: ["Canonical deposit & withdrawal", "Native gas efficiency"],
  },
  {
    name: "ERC-4337 EntryPoint v0.6",
    description: "Canonical account abstraction EntryPoint for smart wallets and paymasters.",
    address: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    standard: "ERC-4337 v0.6",
    verified: true,
    features: ["Bundled UserOperations", "Gas sponsorship execution"],
  },
  {
    name: "ERC-4337 EntryPoint v0.7",
    description: "Upgraded account abstraction EntryPoint supporting latest paymaster standards.",
    address: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    standard: "ERC-4337 v0.7",
    verified: true,
    features: ["Gas optimization", "Modular smart accounts"],
  },
];

const FAQ_ITEMS = [
  {
    category: "General & Guest Access",
    q: "Can I explore tokenized stocks, market charts, and lending yields without connecting a wallet?",
    a: "Yes. Open /explore or /lend to browse all Coinbase tokenized stocks, Morpho & Aave lending markets, live prices, and 24h volume. Guest mode requires zero wallet connection or signatures. Connect your wallet only when you wish to execute trades, deploy tokens, or claim vouchers.",
  },
  {
    category: "Tokenized Equities & Trading",
    q: "How do Coinbase Tokenized Stocks work on Base?",
    a: "Coinbase Tokenized Stocks (e.g. NVDAc, AAPLc, TSLAc, COINc, GOOGLc, MSFTc, AMZNc) are 1:1 backed ERC-20 representations of public equities traded 24/7 on Base mainnet. Our terminal fetches real-time reference prices, calculates NAV differentials, and provides smart routing across DEX pools.",
  },
  {
    category: "Tokenized Equities & Trading",
    q: "How does the Smart DEX Aggregator route trades?",
    a: "The Swap terminal compares liquidity and pricing across Uniswap v3 fee tiers (0.01%, 0.05%, 0.3%, 1%), Aerodrome volatile and stable pools, Slipstream concentrated liquidity, and 0x API fallback. It automatically splits legs and recommends the path with lowest price impact.",
  },
  {
    category: "Token Launchpad & Creator Revenue",
    q: "What are the 3 token launch modes on the Launchpad?",
    a: "1) B20 Vanity Tokens: Mines custom vanity address prefixes (0xB200...) client-side for distinctive branding. 2) Standard ERC-20 Meme Coins: 1-click token launch with customizable initial supply (1B default), creator reserve, insider allocations, and vesting schedules. 3) Stock-Paired Memestocks: Meme coins paired directly against tokenized equities (e.g. meme/NVDAc or meme/AAPLc) on Base.",
  },
  {
    category: "Token Launchpad & Creator Revenue",
    q: "How does Creator Revenue Sharing work on token swaps?",
    a: "All tokens deployed through Base Terminal feature a built-in 0.50% total platform fee split on swaps. 0.25% (or 60% of the platform fee) is automatically and irrevocably streamed directly to the token creator's wallet on every single swap executed through our routing infrastructure.",
  },
  {
    category: "Token Launchpad & Creator Revenue",
    q: "What anti-snipe and launch protection mechanisms are included?",
    a: "Creators can configure anti-snipe block delays (e.g., maximum transaction buy limits in the opening blocks) and cooldown periods. Our protection API (/api/launchpad/protection) continuously monitors pool creation block heights to safeguard fair community launches.",
  },
  {
    category: "Lending & Health Simulator",
    q: "How does the Collateral Health Factor Simulator work?",
    a: "In the Lend & Stake tab (/lend), you can compare lending pools across Morpho Blue, Aave v3, Euler, and Superform. The interactive Health Simulator allows you to adjust collateral valuation drops and borrow utilization surges to visualize your liquidation threshold before executing transactions.",
  },
  {
    category: "Lending & Health Simulator",
    q: "What assets can be deposited as collateral?",
    a: "Depending on the protocol pool, you can deposit blue-chip crypto (WETH, cbBTC, USDC) or tokenized stocks (NVDAc, AAPLc) to borrow USDC cash without liquidating your equities, maintaining long exposure while unlocking immediate onchain liquidity.",
  },
  {
    category: "Base Voucher & AI Agents",
    q: "What is Base Voucher and what assets does it support?",
    a: "Base Voucher is an onchain gift card protocol on Base mainnet. Users deposit a total fund and split it into up to 50 cards with secure secrets (format: XXXXX-XXXXX-XXXXX-XXXXX). Supported assets include native ETH, USDC, Coinbase Tokenized Stocks (NVDAc, AAPLc), and Morpho/Superform Yield Vault shares (mvNVDAc, mvAAPLc, sfNVDAc, mvCOINc).",
  },
  {
    category: "Base Voucher & AI Agents",
    q: "How does a recipient redeem a Base Voucher?",
    a: "Recipients go to /redeem (or open the Vouchers tab), enter their Card ID (e.g. '12-3') and secret, connect any Base wallet, and click 'Redeem'. The contract verifies the keccak256 hash onchain, ensures the card hasn't been claimed, and enforces a one-card-per-wallet rate limit before releasing funds.",
  },
  {
    category: "Base Voucher & AI Agents",
    q: "What is Model Context Protocol (MCP) and how can AI agents use Base Terminal?",
    a: "Our public endpoint at /api/mcp implements Anthropic's Model Context Protocol (MCP). Autonomous agents in Claude Desktop, Cursor, and Base MCP can invoke tools like 'voucher_prepare_create' (build batch calldata), 'voucher_prepare_redeem' (build claim calldata), 'voucher_lookup_batch' (inspect live status), and 'voucher_list_by_creator' to gift and commerce autonomously.",
  },
  {
    category: "Compliance & Product Safeguards",
    q: "Why do I see 'Tokenized stock features are not available in your region'?",
    a: "Under our product compliance guardrails, visitor country is detected server-side at Vercel's edge network via x-vercel-ip-country headers. Users in restricted jurisdictions (such as the United States and sanctioned regions pending legal review) operate under Exit-Only Mode. In this mode, new entries (buying stocks, borrowing, launches, stock voucher creation) are disabled to safeguard the platform.",
  },
  {
    category: "Compliance & Product Safeguards",
    q: "Can I still withdraw my collateral or sell my stocks if my region is restricted?",
    a: "Yes, absolutely. The Exit-Only Guarantee ensures that product safeguards never lock or trap user funds. You can always withdraw deposited collateral, repay outstanding debt, unstake maturing assets, sell existing tokenized stock holdings into USDC or ETH, and claim/redeem valid crypto gift vouchers.",
  },
  {
    category: "Compliance & Product Safeguards",
    q: "Does Base Terminal claim to be legally compliant?",
    a: "No. These controls are product safeguards pending formal legal counsel review, not legal advice. Base Terminal is a non-custodial decentralized interface and never claims to be legally 'compliant' or government-endorsed. Always consult your own legal, tax, and financial advisors.",
  },
  {
    category: "Tokenized Equities & Trading",
    q: "Why do tokenized stock AMM prices sometimes differ from US equity exchange prices?",
    a: "Traditional US equity markets trade 24/5 during official exchange hours, whereas onchain AMM pools on Base trade 24/7. When US exchanges are closed on nights and weekends, onchain prices reflect real-time decentralized pool liquidity and supply/demand, and underlying Chainlink oracle feeds may experience wider spreads or freeze until markets reopen.",
  },
  {
    category: "Wallet Analytics & Scoring",
    q: "How is the Base Activity Score calculated?",
    a: "The score (0–100) measures your wallet's onchain engagement on Base across 6 dimensions: transaction tenure, active days, protocol diversity (DeFi, NFTs, social, bridging), daily check-in streaks, volume transacted, and smart account (ERC-4337 user ops) adoption.",
  },
];

export default function DocumentsClient() {
  const [activeTab, setActiveTab] = useState<DocTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeEndpointId, setActiveEndpointId] = useState<string>("stocks");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredEndpoints = useMemo(() => {
    if (!searchQuery.trim()) return API_ENDPOINTS;
    const q = searchQuery.toLowerCase();
    return API_ENDPOINTS.filter(
      (ep) =>
        ep.title.toLowerCase().includes(q) ||
        ep.path.toLowerCase().includes(q) ||
        ep.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_ITEMS;
    const q = searchQuery.toLowerCase();
    return FAQ_ITEMS.filter(
      (item) =>
        item.q.toLowerCase().includes(q) ||
        item.a.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const activeEndpoint = useMemo(() => {
    return API_ENDPOINTS.find((ep) => ep.id === activeEndpointId) || API_ENDPOINTS[0];
  }, [activeEndpointId]);

  return (
    <div className="min-h-screen min-h-[100dvh] w-full min-w-0 bg-[var(--background)] text-[var(--ink)] flex flex-col transition-colors">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-[var(--border-subtle)] bg-[var(--surface)]/90 backdrop-blur-md pt-[env(safe-area-inset-top,0px)]">
        <div className="app-container flex min-w-0 items-center justify-between gap-3 py-3">
          <Link href="/explore" className="group flex shrink-0 items-center gap-2.5">
            <AppLogo size="sm" />
            <span className="font-display truncate text-base font-bold tracking-tight text-[var(--ink)] sm:text-xl">
              Base Analytics
            </span>
            <span className="badge badge-brand text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5">
              Docs &amp; API
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold text-[var(--ink-muted)]">
              <Link href="/explore" className="px-2.5 py-1.5 rounded-lg hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition">
                Explore
              </Link>
              <Link href="/swap" className="px-2.5 py-1.5 rounded-lg hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition">
                Swap
              </Link>
              <Link href="/launch" className="px-2.5 py-1.5 rounded-lg hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition">
                Launchpad
              </Link>
              <Link href="/lend" className="px-2.5 py-1.5 rounded-lg hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition">
                Lend &amp; Stake
              </Link>
              <Link href="/redeem" className="px-2.5 py-1.5 rounded-lg hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition">
                Vouchers
              </Link>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="app-container relative z-10 py-8 sm:py-10 md:py-12 flex-1 space-y-12">
        {/* Hero Section */}
        <div className="brand-hero-wrap min-h-[220px] sm:min-h-[260px] rounded-2xl overflow-hidden relative shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/base-analytics-hero-lanes.png"
            alt="Base Terminal Hero"
            className="brand-hero-img"
          />
          <div className="brand-hero-overlay" aria-hidden />
          <div className="lane-rail absolute bottom-0 left-0 right-0 h-1.5 z-[2]" aria-hidden />

          <div className="brand-hero-body flex h-full flex-col justify-end p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="badge badge-brand inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
                <Sparkles size={12} /> Documentation &amp; Developer Portal
              </span>
              <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Base Mainnet 8453
              </span>
            </div>

            <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl md:text-5xl">
              Base Terminal Documents
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] sm:text-base leading-relaxed text-[var(--ink-muted)]">
              Architecture, developer guides, Model Context Protocol (MCP) agent tools, and public REST APIs for
              tokenized stocks, multi-DEX routing, token launches, lending comparisons, and crypto vouchers.
            </p>

            {/* Quick Action Badges */}
            <div className="mt-5 flex flex-wrap gap-2.5 text-xs font-semibold">
              <a href="#quick-start" className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2">
                <Zap size={14} /> Quick Start
              </a>
              <a href="#compliance" className="btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2">
                <ShieldCheck size={14} /> Compliance &amp; Safety
              </a>
              <a href="#apis" className="btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2">
                <Terminal size={14} /> Public REST API
              </a>
              <a href="#mcp" className="btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2">
                <Cpu size={14} /> AI Agents &amp; MCP
              </a>
              <a href="#contracts" className="btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2">
                <Shield size={14} /> Smart Contracts
              </a>
            </div>
          </div>
        </div>

        {/* Global Search and Filter Bar */}
        <section className="card p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-dim)] pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search guides, endpoints, parameters, or questions..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-sm text-[var(--ink)] placeholder-[var(--ink-dim)] focus:outline-none focus:border-[var(--brand)] transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--ink-dim)] hover:text-[var(--ink)]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {(
                [
                  { id: "all", label: "All Topics" },
                  { id: "compliance", label: "Compliance & Safety" },
                  { id: "stocks", label: "Stocks" },
                  { id: "swap", label: "Swap" },
                  { id: "launchpad", label: "Launchpad" },
                  { id: "lend", label: "Lending" },
                  { id: "vouchers", label: "Vouchers" },
                  { id: "mcp", label: "MCP & Agents" },
                  { id: "api", label: "API" },
                  { id: "contracts", label: "Contracts" },
                  { id: "faq", label: "FAQ" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-[var(--brand)] text-white shadow-sm"
                      : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--border-subtle)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Section: Platform Overview & Architecture */}
        {(activeTab === "all" || activeTab === "overview") && (
          <section id="quick-start" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand)]">
                  Architecture &amp; Features
                </span>
                <h2 className="font-display text-2xl font-bold text-[var(--ink)] mt-1">
                  Terminal Modules at a Glance
                </h2>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="card p-5 hover:border-[var(--brand)] transition group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <TrendingUp size={20} />
                  </div>
                  <h3 className="font-display text-base font-bold text-[var(--ink)]">
                    Coinbase Tokenized Stocks
                  </h3>
                </div>
                <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                  24/7 equities on Base (NVDAc, AAPLc, TSLAc, COINc, GOOGLc, MSFTc, AMZNc). 1:1 backing,
                  live reference pricing feeds, interactive charts, and instant in-app swap routing.
                </p>
                <Link href="/explore" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--brand)] group-hover:translate-x-0.5 transition">
                  Explore stocks <ArrowUpRight size={13} />
                </Link>
              </div>

              <div className="card p-5 hover:border-[var(--brand)] transition group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                    <Repeat size={20} />
                  </div>
                  <h3 className="font-display text-base font-bold text-[var(--ink)]">
                    Smart DEX Routing
                  </h3>
                </div>
                <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                  Aggregates Uniswap v3 (all fee tiers), Aerodrome volatile/stable, Slipstream concentrated
                  liquidity, and 0x API fallback with automated 0.25% creator revenue fee routing.
                </p>
                <Link href="/swap" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--brand)] group-hover:translate-x-0.5 transition">
                  Open Swap terminal <ArrowUpRight size={13} />
                </Link>
              </div>

              <div className="card p-5 hover:border-[var(--brand)] transition group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <Coins size={20} />
                  </div>
                  <h3 className="font-display text-base font-bold text-[var(--ink)]">
                    3-Mode Token Launchpad
                  </h3>
                </div>
                <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                  Deploy vanity 0xB200... tokens, ERC-20 meme coins, or stock-paired memestocks (paired with
                  NVDAc / AAPLc) with built-in creator revenue sharing and anti-snipe block guards.
                </p>
                <Link href="/launch" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--brand)] group-hover:translate-x-0.5 transition">
                  Launch a token <ArrowUpRight size={13} />
                </Link>
              </div>

              <div className="card p-5 hover:border-[var(--brand)] transition group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    <Scale size={20} />
                  </div>
                  <h3 className="font-display text-base font-bold text-[var(--ink)]">
                    Lend &amp; Health Simulator
                  </h3>
                </div>
                <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                  Compare supply &amp; borrow yields across Morpho Blue, Aave v3, Euler, and Superform.
                  Interactive simulator stress-tests collateral price drops and liquidation thresholds.
                </p>
                <Link href="/lend" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--brand)] group-hover:translate-x-0.5 transition">
                  Compare lending yields <ArrowUpRight size={13} />
                </Link>
              </div>

              <div className="card p-5 hover:border-[var(--brand)] transition group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                    <Gift size={20} />
                  </div>
                  <h3 className="font-display text-base font-bold text-[var(--ink)]">
                    Base Voucher Protocol
                  </h3>
                </div>
                <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                  Onchain crypto gift cards. Split ETH, USDC, Tokenized Stocks, or Morpho Yield Vault shares
                  into up to 50 cards with secure Card ID + Secret redemption and instant gifting.
                </p>
                <Link href="/redeem" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--brand)] group-hover:translate-x-0.5 transition">
                  Redeem or create vouchers <ArrowUpRight size={13} />
                </Link>
              </div>

              <div className="card p-5 hover:border-[var(--brand)] transition group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
                    <Cpu size={20} />
                  </div>
                  <h3 className="font-display text-base font-bold text-[var(--ink)]">
                    Model Context Protocol (MCP)
                  </h3>
                </div>
                <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                  Autonomous agent integration via /api/mcp. Prepares unsigned calldata for batch creations,
                  redemptions, live status lookups, and creator batch indexing.
                </p>
                <a href="#mcp" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--brand)] group-hover:translate-x-0.5 transition">
                  View MCP specs <ArrowUpRight size={13} />
                </a>
              </div>

              <div className="card p-5 hover:border-[var(--brand)] transition group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                    <ShieldCheck size={20} />
                  </div>
                  <h3 className="font-display text-base font-bold text-[var(--ink)]">
                    Compliance &amp; Safety
                  </h3>
                </div>
                <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                  Configurable product guardrails: Edge geo-gating, Exit-Only guarantee (user funds are never blocked),
                  first-use risk modal, remote kill switch, and trademark collision protection.
                </p>
                <a
                  href="#compliance"
                  onClick={() => setActiveTab("compliance")}
                  className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--brand)] group-hover:translate-x-0.5 transition cursor-pointer"
                >
                  View safety architecture <ArrowUpRight size={13} />
                </a>
              </div>
            </div>
          </section>
        )}

        {/* Section: Model Context Protocol (MCP) & AI Agents */}
        {(activeTab === "all" || activeTab === "mcp") && (
          <section id="mcp" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand)]">
                  Autonomous AI Integration
                </span>
                <h2 className="font-display text-2xl font-bold text-[var(--ink)] mt-1 flex items-center gap-2">
                  <Cpu size={22} className="text-[var(--brand)]" />
                  Model Context Protocol (MCP)
                </h2>
              </div>
              <span className="badge badge-brand text-[10px] font-bold">MCP v1.26</span>
            </div>

            <div className="card p-6 space-y-5">
              <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                Base Terminal exposes an official remote MCP server at{" "}
                <code className="rounded bg-[var(--surface-2)] px-2 py-0.5 font-mono text-xs text-[var(--ink)] font-bold">
                  https://base-analytics-app.vercel.app/api/mcp
                </code>
                . AI agents running in Claude Desktop, Cursor, OpenAI GPTs, or autonomous scripts can
                autonomously query vouchers, prepare unsigned batches, and manage crypto gift commerce on Base.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 space-y-2">
                  <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <Terminal size={14} className="text-[var(--brand)]" />
                    Claude Code / CLI Setup
                  </span>
                  <div className="flex items-center justify-between rounded-lg bg-[var(--surface)] p-2.5 font-mono text-xs text-[var(--ink-muted)]">
                    <span className="truncate">claude mcp add --transport http base-voucher https://base-analytics-app.vercel.app/api/mcp</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          "claude mcp add --transport http base-voucher https://base-analytics-app.vercel.app/api/mcp",
                          "mcp-cli"
                        )
                      }
                      className="ml-2 shrink-0 text-[var(--ink-dim)] hover:text-[var(--ink)]"
                    >
                      {copiedId === "mcp-cli" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 space-y-2">
                  <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <Code2 size={14} className="text-[var(--brand)]" />
                    Cursor / Claude Desktop Config
                  </span>
                  <div className="flex items-center justify-between rounded-lg bg-[var(--surface)] p-2.5 font-mono text-xs text-[var(--ink-muted)]">
                    <span className="truncate">{`{"mcpServers":{"baseVoucher":{"url":"https://base-analytics-app.vercel.app/api/mcp"}}}`}</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          JSON.stringify(
                            {
                              mcpServers: {
                                baseVoucher: {
                                  url: "https://base-analytics-app.vercel.app/api/mcp",
                                },
                              },
                            },
                            null,
                            2
                          ),
                          "mcp-json"
                        )
                      }
                      className="ml-2 shrink-0 text-[var(--ink-dim)] hover:text-[var(--ink)]"
                    >
                      {copiedId === "mcp-json" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* MCP Registered Tools Table */}
              <div className="space-y-3">
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[var(--ink-dim)]">
                  Registered MCP Tools
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[var(--ink-dim)]">
                        <th className="py-2.5 px-3 font-semibold">Tool Name</th>
                        <th className="py-2.5 px-3 font-semibold">Inputs</th>
                        <th className="py-2.5 px-3 font-semibold">Description</th>
                        <th className="py-2.5 px-3 font-semibold">Returns</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--ink)]">
                      <tr>
                        <td className="py-3 px-3 font-mono font-bold text-[var(--brand)]">
                          voucher_prepare_create
                        </td>
                        <td className="py-3 px-3 font-mono text-[var(--ink-muted)]">
                          total, cards (1-50), asset?, message?, creator?
                        </td>
                        <td className="py-3 px-3 text-[var(--ink-muted)]">
                          Builds unsigned calldata and cryptographic card secrets for batch creation on Base.
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-600 dark:text-emerald-400">
                          calls[], cards[]
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 font-mono font-bold text-[var(--brand)]">
                          voucher_prepare_redeem
                        </td>
                        <td className="py-3 px-3 font-mono text-[var(--ink-muted)]">
                          cardId (&quot;12-3&quot;), secret
                        </td>
                        <td className="py-3 px-3 text-[var(--ink-muted)]">
                          Builds unsigned redeem calldata for Base MCP send_calls with amount preview.
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-600 dark:text-emerald-400">
                          calls[], preview
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 font-mono font-bold text-[var(--brand)]">
                          voucher_lookup_batch
                        </td>
                        <td className="py-3 px-3 font-mono text-[var(--ink-muted)]">
                          batchId (number)
                        </td>
                        <td className="py-3 px-3 text-[var(--ink-muted)]">
                          Live onchain batch metadata and card status (redeemed vs available). No secrets returned.
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-600 dark:text-emerald-400">
                          batchStatus, cards[]
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 font-mono font-bold text-[var(--brand)]">
                          voucher_list_by_creator
                        </td>
                        <td className="py-3 px-3 font-mono text-[var(--ink-muted)]">
                          creator (0x address)
                        </td>
                        <td className="py-3 px-3 text-[var(--ink-muted)]">
                          Indexes all batches created by a wallet with total unredeemed statistics.
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-600 dark:text-emerald-400">
                          batches[], totalUnredeemed
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Section: Public REST APIs */}
        {(activeTab === "all" || activeTab === "api") && (
          <section id="apis" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand)]">
                  Developer Integration
                </span>
                <h2 className="font-display text-2xl font-bold text-[var(--ink)] mt-1 flex items-center gap-2">
                  <Terminal size={22} className="text-[var(--brand)]" />
                  Public REST API Endpoints
                </h2>
              </div>
              <span className="text-xs font-mono text-[var(--ink-dim)]">
                Base URL: {APP_URL_WEB}
              </span>
            </div>

            <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6 items-start">
              {/* Endpoint Selector List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-dim)]">
                    Available Endpoints ({filteredEndpoints.length})
                  </span>
                </div>

                <div className="space-y-1.5 max-h-[580px] overflow-y-auto pr-1">
                  {filteredEndpoints.map((ep) => {
                    const active = ep.id === activeEndpoint.id;
                    return (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() => setActiveEndpointId(ep.id)}
                        className={`w-full text-left p-3 rounded-xl border transition flex items-start gap-2.5 ${
                          active
                            ? "bg-[var(--surface-2)] border-[var(--brand)] shadow-sm"
                            : "bg-[var(--surface)] border-[var(--border-subtle)] hover:border-[var(--brand)]/50"
                        }`}
                      >
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase font-mono ${
                            ep.method === "GET"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {ep.method}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs font-bold text-[var(--ink)] truncate">
                            {ep.path}
                          </p>
                          <p className="text-[11px] text-[var(--ink-muted)] truncate mt-0.5">
                            {ep.title}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Endpoint Inspector */}
              <div className="card p-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-extrabold uppercase font-mono ${
                        activeEndpoint.method === "GET"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      {activeEndpoint.method}
                    </span>
                    <span className="font-mono text-sm font-bold text-[var(--ink)]">
                      {activeEndpoint.path}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-[var(--ink)]">
                    {activeEndpoint.title}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--ink-muted)] leading-relaxed">
                    {activeEndpoint.description}
                  </p>
                </div>

                {/* Parameters Table */}
                {activeEndpoint.params && activeEndpoint.params.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-dim)]">
                      Parameters
                    </span>
                    <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[var(--surface-2)] text-[var(--ink-dim)] border-b border-[var(--border-subtle)]">
                          <tr>
                            <th className="py-2 px-3 font-semibold">Name</th>
                            <th className="py-2 px-3 font-semibold">Type</th>
                            <th className="py-2 px-3 font-semibold">Required</th>
                            <th className="py-2 px-3 font-semibold">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                          {activeEndpoint.params.map((p) => (
                            <tr key={p.name}>
                              <td className="py-2 px-3 font-mono font-bold text-[var(--ink)]">
                                {p.name}
                              </td>
                              <td className="py-2 px-3 font-mono text-[var(--brand)]">
                                {p.type}
                              </td>
                              <td className="py-2 px-3">
                                {p.required ? (
                                  <span className="text-red-500 font-bold">Yes</span>
                                ) : (
                                  <span className="text-[var(--ink-dim)]">No</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-[var(--ink-muted)]">
                                {p.description}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* cURL Example */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-dim)]">
                      cURL Request Example
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(activeEndpoint.exampleCurl, "curl")}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand)] hover:underline"
                    >
                      {copiedId === "curl" ? (
                        <>
                          <Check size={12} className="text-emerald-500" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={12} /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--ink)] overflow-x-auto whitespace-pre-wrap">
                    {activeEndpoint.exampleCurl}
                  </pre>
                </div>

                {/* JSON Response Example */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-dim)]">
                      Example Response (200 OK)
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(activeEndpoint.exampleResponse, "resp")}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand)] hover:underline"
                    >
                      {copiedId === "resp" ? (
                        <>
                          <Check size={12} className="text-emerald-500" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={12} /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] font-mono text-xs text-emerald-600 dark:text-emerald-400 overflow-x-auto max-h-[220px]">
                    {activeEndpoint.exampleResponse}
                  </pre>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Section: Compliance & Product Safeguards */}
        {(activeTab === "all" || activeTab === "compliance") && (
          <section id="compliance" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand)]">
                  Product Safeguards &amp; Legal Disclosures
                </span>
                <h2 className="font-display text-2xl font-bold text-[var(--ink)] mt-1 flex items-center gap-2">
                  <ShieldCheck size={22} className="text-[var(--brand)]" />
                  Compliance Guardrails &amp; Exit-Only Architecture
                </h2>
              </div>
              <span className="badge badge-brand text-[10px] font-bold">Product Safeguards</span>
            </div>

            <div className="card p-6 space-y-5">
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200 leading-relaxed space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                  Regulatory Notice &amp; Legal Review Disclaimer
                </span>
                <p>
                  These features are product safeguards pending formal legal counsel review, not legal advice.
                  Base Terminal is a decentralized, non-custodial interface and never claims to be legally &ldquo;compliant&rdquo;
                  or government-endorsed. Availability depends on your jurisdiction and the issuer&apos;s regulatory terms.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 space-y-2">
                  <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <Shield size={14} className="text-[var(--brand)]" />
                    The Exit-Only Guarantee
                  </span>
                  <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                    Product safeguards <strong>never block users from accessing their own funds</strong>. Users in restricted
                    regions or under safety pauses can always withdraw collateral, repay loans, unstake assets, sell stock tokens
                    into USDC/ETH, and redeem existing gift vouchers.
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 space-y-2">
                  <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <Compass size={14} className="text-[var(--brand)]" />
                    Server-Side Edge Geo-Gating
                  </span>
                  <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                    Visitor countries are detected server-side via edge network headers (<code>x-vercel-ip-country</code>).
                    Client-supplied headers are never trusted. We transparently disclose that IP geolocation can be bypassed via VPNs
                    and serves as an application-level product safeguard layer.
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 space-y-2">
                  <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <Zap size={14} className="text-[var(--brand)]" />
                    Remote Safety Kill Switch
                  </span>
                  <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                    A centralized, typed configuration supported by Vercel Edge Config enables instant, zero-redeploy pausing
                    of tokenized stock entry points (buys, borrows, launches, voucher creation) with safe local fallback.
                  </p>
                </div>
              </div>

              {/* Legal Pages & Policy Links Row */}
              <div className="pt-2 border-t border-[var(--border-subtle)]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-dim)] mb-2.5">
                  Legal Documents &amp; Policy Schedules
                </h4>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Link href="/restricted-regions" className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5">
                    <span>Restricted Regions Policy</span>
                    <ArrowUpRight size={12} />
                  </Link>
                  <Link href="/risk-disclosure" className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5">
                    <span>Risk Disclosure</span>
                    <ArrowUpRight size={12} />
                  </Link>
                  <Link href="/terms" className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5">
                    <span>Terms of Service</span>
                    <ArrowUpRight size={12} />
                  </Link>
                  <Link href="/privacy" className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5">
                    <span>Privacy Policy</span>
                    <ArrowUpRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Section: Smart Contracts Reference */}
        {(activeTab === "all" || activeTab === "contracts") && (
          <section id="contracts" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand)]">
                  Onchain Protocol
                </span>
                <h2 className="font-display text-2xl font-bold text-[var(--ink)] mt-1 flex items-center gap-2">
                  <Shield size={22} className="text-[var(--brand)]" />
                  Verified Smart Contracts
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-brand text-[10px] font-mono">
                  Builder Code: {BUILDER_CODE}
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {CONTRACTS_LIST.map((c) => (
                <div key={c.name} className="card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-[var(--ink)]">
                      {c.name}
                    </h3>
                    <span className="rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[10px] font-mono font-bold">
                      {c.standard}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                    {c.description}
                  </p>

                  <div className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] p-2.5 font-mono text-xs text-[var(--ink)] border border-[var(--border-subtle)]">
                    <span className="truncate">{c.address}</span>
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(c.address, c.name)}
                        className="text-[var(--ink-dim)] hover:text-[var(--ink)] p-1"
                        title="Copy Address"
                      >
                        {copiedId === c.name ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </button>
                      {c.address.startsWith("0x") && (
                        <a
                          href={`https://basescan.org/address/${c.address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--ink-dim)] hover:text-[var(--brand)] p-1"
                          title="View on BaseScan"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {c.features.map((f) => (
                      <span
                        key={f}
                        className="rounded-full bg-[var(--surface-2)] text-[var(--ink-dim)] text-[10px] font-medium px-2 py-0.5 border border-[var(--border-subtle)]"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section: Comprehensive FAQ */}
        {(activeTab === "all" || activeTab === "faq") && (
          <section id="faq" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand)]">
                  Knowledge Base
                </span>
                <h2 className="font-display text-2xl font-bold text-[var(--ink)] mt-1 flex items-center gap-2">
                  <BookOpen size={22} className="text-[var(--brand)]" />
                  Frequently Asked Questions
                </h2>
              </div>
              <span className="text-xs font-semibold text-[var(--ink-muted)]">
                {filteredFaqs.length} questions
              </span>
            </div>

            <div className="space-y-3">
              {filteredFaqs.map((item, idx) => {
                const isOpen = expandedFaq === idx;
                return (
                  <div key={item.q} className="card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedFaq(isOpen ? null : idx)}
                      className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-[var(--surface-2)]/50 transition"
                    >
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand)] block mb-1">
                          {item.category}
                        </span>
                        <p className="text-sm font-bold text-[var(--ink)]">
                          {item.q}
                        </p>
                      </div>
                      <ChevronDown
                        size={18}
                        className={`shrink-0 text-[var(--ink-dim)] transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-[var(--brand)]" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-5 pt-1 sm:px-5 border-t border-[var(--border-subtle)] bg-[var(--surface-2)]/30">
                        <p className="text-xs sm:text-sm leading-relaxed text-[var(--ink-muted)]">
                          {item.a}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Bottom Navigation CTA Banner */}
        <section className="card p-6 sm:p-8 bg-gradient-to-r from-[var(--surface)] to-[var(--surface-2)] border-[var(--border-subtle)] text-center space-y-4">
          <h2 className="font-display text-2xl font-bold text-[var(--ink)]">
            Ready to explore the Base Trading Terminal?
          </h2>
          <p className="text-sm text-[var(--ink-muted)] max-w-lg mx-auto">
            Experience real-time tokenized stocks, execute smart routing swaps with creator revenue sharing, or split crypto gift cards in one click.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/explore" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
              <Compass size={16} /> Explore Stocks &amp; Tokens
            </Link>
            <Link href="/swap" className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
              <Repeat size={16} /> Swap Tokens
            </Link>
            <Link href="/launch" className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
              <Coins size={16} /> Launchpad
            </Link>
            <Link href="/lend" className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
              <Scale size={16} /> Lend &amp; Stake
            </Link>
            <Link href="/redeem" className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
              <Gift size={16} /> Base Voucher
            </Link>
          </div>
        </section>
      </main>

      {/* Global Theme-Matched Footer */}
      <AppFooterNav />
    </div>
  );
}
