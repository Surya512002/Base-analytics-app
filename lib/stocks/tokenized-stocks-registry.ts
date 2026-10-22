import { getAddress, type Address } from "viem";

export type StockCategory =
  | "Tech"
  | "Finance"
  | "Healthcare"
  | "Consumer"
  | "Energy"
  | "Crypto-related"
  | "ETF/Index"
  | "Other";

export type StockIssuer =
  | "Coinbase"
  | "Dinari"
  | "Backed"
  | "Ondo"
  | "Superstate"
  | "Other";

export type StockStatus = "active" | "paused" | "deprecated" | "pending";

export interface StockPriceFeed {
  type: "chainlink" | "pyth" | "dex";
  address?: Address;
}

export interface StockRestrictions {
  transferRestricted: boolean;
  allowlistOnly: boolean;
  pausable: boolean;
  rebasingOrSplits: boolean;
  legalNote?: string;
}

export interface TokenizedStockEntry {
  symbol: string;
  name: string;
  underlyingTicker: string;
  address: Address;
  decimals: number;
  category: StockCategory;
  issuer: StockIssuer;
  priceFeed: StockPriceFeed;
  logo: string;
  status: StockStatus;
  addedAt: string; // ISO 8601 date string e.g. "2024-01-15T00:00:00Z"
  restrictions: StockRestrictions;
  description?: string;
  trademarkNotice?: string;
}

/**
 * SINGLE SOURCE OF TRUTH TOKENIZED STOCK REGISTRY FOR BASE MAINNET (CHAIN ID 8453)
 * Every address is strictly EIP-55 checksummed via viem `getAddress`.
 * Backed by custody equity shares (Coinbase B20 Standard & RWAs).
 */
export const TOKENIZED_STOCKS_REGISTRY: readonly TokenizedStockEntry[] = [
  {
    symbol: "NVDAc",
    name: "NVIDIA",
    underlyingTicker: "NVDA",
    address: getAddress("0xb20000000000000000000078ee7ce2fe4908108c"),
    decimals: 8,
    category: "Tech",
    issuer: "Coinbase",
    priceFeed: {
      type: "chainlink",
      address: getAddress("0x04689a41629776563E6822F76f2e57D148d28513"),
    },
    logo: "/tokens/0xb20000000000000000000078ee7ce2fe4908108c.png",
    status: "active",
    addedAt: "2024-03-01T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
      legalNote: "Backed 1:1 by NVIDIA common stock shares held in qualified custody. Subject to US equity market hours for off-chain settlement.",
    },
    description: "NVIDIA Corporation designs graphics processing units (GPUs) and AI computing platforms.",
  },
  {
    symbol: "AAPLc",
    name: "Apple",
    underlyingTicker: "AAPL",
    address: getAddress("0xb200000000000000000000c2e324d24d7eecd1fb"),
    decimals: 8,
    category: "Tech",
    issuer: "Coinbase",
    priceFeed: {
      type: "chainlink",
      address: getAddress("0x787f13dEa48Db0897CbCDD985de77809D837F988"),
    },
    logo: "/tokens/0xb200000000000000000000c2e324d24d7eecd1fb.png",
    status: "active",
    addedAt: "2024-03-01T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
      legalNote: "Backed 1:1 by Apple Inc. common stock held in qualified custody.",
    },
    description: "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, and wearables.",
  },
  {
    symbol: "TSLAc",
    name: "Tesla",
    underlyingTicker: "TSLA",
    address: getAddress("0xb2000000000000000000001e800a7f5189430cd0"),
    decimals: 8,
    category: "Consumer",
    issuer: "Coinbase",
    priceFeed: {
      type: "chainlink",
      address: getAddress("0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4"),
    },
    logo: "/tokens/0xb2000000000000000000001e800a7f5189430cd0.png",
    status: "active",
    addedAt: "2024-03-01T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
      legalNote: "Backed 1:1 by Tesla Inc. common stock held in qualified custody.",
    },
    description: "Tesla designs, develops, manufactures, sells, and leases electric vehicles and energy storage systems.",
  },
  {
    symbol: "COINc",
    name: "Coinbase",
    underlyingTicker: "COIN",
    address: getAddress("0xb200000000000000000000c85a31389d71f3ecfb"),
    decimals: 8,
    category: "Crypto-related",
    issuer: "Coinbase",
    priceFeed: {
      type: "chainlink",
      address: getAddress("0x408e44f504A7371a345F03a73dDC96A4b48e8aa7"),
    },
    logo: "/tokens/0xb200000000000000000000c85a31389d71f3ecfb.png",
    status: "active",
    addedAt: "2024-03-01T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
      legalNote: "Backed 1:1 by Coinbase Global Inc. Class A shares held in qualified custody.",
    },
    description: "Coinbase Global provides financial infrastructure and technology for the cryptoeconomy.",
  },
  {
    symbol: "GOOGLc",
    name: "Alphabet Inc. (Google)",
    underlyingTicker: "GOOGL",
    address: getAddress("0xb2000000000000000000002d0ba3164cc74f58b7"),
    decimals: 8,
    category: "Tech",
    issuer: "Coinbase",
    priceFeed: {
      type: "chainlink",
      address: getAddress("0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2"),
    },
    logo: "/tokens/0xb2000000000000000000002d0ba3164cc74f58b7.png",
    status: "active",
    addedAt: "2024-03-01T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Alphabet Inc. offers online advertising services, search engines, cloud computing, and hardware.",
  },
  {
    symbol: "MSFTc",
    name: "Microsoft Corp",
    underlyingTicker: "MSFT",
    address: getAddress("0xb200000000000000000000ab99cfa739e253872b"),
    decimals: 8,
    category: "Tech",
    issuer: "Coinbase",
    priceFeed: {
      type: "chainlink",
      address: getAddress("0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c"),
    },
    logo: "/tokens/0xb200000000000000000000ab99cfa739e253872b.png",
    status: "active",
    addedAt: "2024-03-01T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Microsoft Corporation develops software, consumer electronics, personal computers, and cloud services.",
  },
  {
    symbol: "AMZNc",
    name: "Amazon.com Inc.",
    underlyingTicker: "AMZN",
    address: getAddress("0xb200000000000000000000d9192b6b456483c2e8"),
    decimals: 8,
    category: "Consumer",
    issuer: "Coinbase",
    priceFeed: {
      type: "chainlink",
      address: getAddress("0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295"),
    },
    logo: "/tokens/0xb200000000000000000000d9192b6b456483c2e8.png",
    status: "active",
    addedAt: "2024-03-01T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Amazon focuses on e-commerce, cloud computing, online advertising, digital streaming, and AI.",
  },
  {
    symbol: "METAc",
    name: "Meta Platforms Inc.",
    underlyingTicker: "META",
    address: getAddress("0xb2000000000000000000008bc8786b856e61707c"),
    decimals: 8,
    category: "Tech",
    issuer: "Coinbase",
    priceFeed: {
      type: "chainlink",
      address: getAddress("0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D"),
    },
    logo: "/tokens/0xb2000000000000000000008bc8786b856e61707c.png",
    status: "active",
    addedAt: "2024-03-01T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Meta builds technologies that help people connect, find communities, and grow businesses.",
  },
  {
    symbol: "MSTRc",
    name: "MicroStrategy Inc.",
    underlyingTicker: "MSTR",
    address: getAddress("0xb2000000000000000000004884b426556b92883d"),
    decimals: 8,
    category: "Crypto-related",
    issuer: "Coinbase",
    priceFeed: {
      type: "chainlink",
      address: getAddress("0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a"),
    },
    logo: "/tokens/0xb2000000000000000000004884b426556b92883d.png",
    status: "active",
    addedAt: "2024-03-01T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "MicroStrategy is an enterprise business intelligence application and major corporate Bitcoin treasury holder.",
  },
  {
    symbol: "CRCLc",
    name: "Circle Internet Financial",
    underlyingTicker: "CRCL",
    address: getAddress("0xb20000000000000000000019f6e7c675b73c2e4d"),
    decimals: 8,
    category: "Crypto-related",
    issuer: "Coinbase",
    priceFeed: {
      type: "chainlink",
      address: getAddress("0x0231cF2635D1E17bB5c2462cc7504Ba1fBd61f33"),
    },
    logo: "/tokens/0xb20000000000000000000019f6e7c675b73c2e4d.png",
    status: "active",
    addedAt: "2024-03-01T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Circle is a global financial technology firm that enables businesses to harness stablecoins like USDC.",
  },
  {
    symbol: "INTCc",
    name: "Intel Corp",
    underlyingTicker: "INTC",
    address: getAddress("0xb2000000000000000000004aff16039ba04bdfbc"),
    decimals: 8,
    category: "Tech",
    issuer: "Coinbase",
    priceFeed: {
      type: "chainlink",
      address: getAddress("0xAB657C39bac0D5886250D70849e2E3E008F2EECB"),
    },
    logo: "/tokens/0xb2000000000000000000004aff16039ba04bdfbc.png",
    status: "active",
    addedAt: "2024-03-01T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Intel Corporation is one of the world's largest semiconductor chip manufacturers by revenue.",
  },
  {
    symbol: "SPCXc",
    name: "SpaceX",
    underlyingTicker: "SPCX",
    address: getAddress("0xb2000000000000000000007b9fcbd005511acbd5"),
    decimals: 8,
    category: "Tech",
    issuer: "Coinbase",
    priceFeed: {
      type: "chainlink",
      address: getAddress("0x6A634B235903C4ad6376892180d6fF8612e3Fa68"),
    },
    logo: "/tokens/0xb2000000000000000000007b9fcbd005511acbd5.png",
    status: "active",
    addedAt: "2024-03-01T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
      legalNote: "Private equity secondary vehicle synthetically referenced.",
    },
    description: "Space Exploration Technologies Corp. manufactures aerospace equipment and space transportation.",
  },
  {
    symbol: "SNDKc",
    name: "SanDisk / Western Digital",
    underlyingTicker: "SNDK",
    address: getAddress("0xb200000000000000000000397293cb8cda9a10c5"),
    decimals: 8,
    category: "Tech",
    issuer: "Coinbase",
    priceFeed: {
      type: "chainlink",
      address: getAddress("0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA"),
    },
    logo: "/tokens/0xb200000000000000000000397293cb8cda9a10c5.png",
    status: "active",
    addedAt: "2024-03-01T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "SanDisk develops flash memory storage solutions and solid-state drives.",
  },
  {
    symbol: "PLTRc",
    name: "Palantir Technologies",
    underlyingTicker: "PLTR",
    address: getAddress("0xb2000000000000000000007d16372840df4dabbe"),
    decimals: 8,
    category: "Tech",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb2000000000000000000007d16372840df4dabbe.png",
    status: "active",
    addedAt: "2024-03-15T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Palantir Technologies builds software and big data analytics platforms for defense and enterprise.",
  },
  {
    symbol: "AMDc",
    name: "Advanced Micro Devices",
    underlyingTicker: "AMD",
    address: getAddress("0xb2000000000000000000000d8ce462e99ee7a47b"),
    decimals: 8,
    category: "Tech",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb2000000000000000000000d8ce462e99ee7a47b.png",
    status: "active",
    addedAt: "2024-03-15T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "AMD develops semiconductor processors, graphics cards, and server technology.",
  },
  {
    symbol: "ARMc",
    name: "Arm Holdings plc",
    underlyingTicker: "ARM",
    address: getAddress("0xb20000000000000000000026215d755356e5043f"),
    decimals: 8,
    category: "Tech",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb20000000000000000000026215d755356e5043f.png",
    status: "active",
    addedAt: "2024-03-15T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Arm designs central processing unit architectures used in the vast majority of mobile devices globally.",
  },
  {
    symbol: "NFLXc",
    name: "Netflix Inc.",
    underlyingTicker: "NFLX",
    address: getAddress("0xb20000000000000000000058b8c947e44011dfe6"),
    decimals: 8,
    category: "Consumer",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb20000000000000000000058b8c947e44011dfe6.png",
    status: "active",
    addedAt: "2024-03-15T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Netflix is an entertainment service provider offering movies and television shows across streaming platforms.",
  },
  {
    symbol: "RKLBc",
    name: "Rocket Lab USA Inc.",
    underlyingTicker: "RKLB",
    address: getAddress("0xb200000000000000000000e8e50cbbb9a3861a3c"),
    decimals: 8,
    category: "Tech",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb200000000000000000000e8e50cbbb9a3861a3c.png",
    status: "active",
    addedAt: "2024-03-15T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Rocket Lab provides launch services, satellite manufacturing, and on-orbit management solutions.",
  },
  {
    symbol: "RDDTc",
    name: "Reddit Inc.",
    underlyingTicker: "RDDT",
    address: getAddress("0xb20000000000000000000066242d4067724cb7a1"),
    decimals: 8,
    category: "Tech",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb20000000000000000000066242d4067724cb7a1.png",
    status: "active",
    addedAt: "2024-03-22T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Reddit is an American social news aggregation, content rating, and discussion website.",
  },
  {
    symbol: "RIVNc",
    name: "Rivian Automotive",
    underlyingTicker: "RIVN",
    address: getAddress("0xb2000000000000000000003e4249c65bd6c037d9"),
    decimals: 8,
    category: "Consumer",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb2000000000000000000003e4249c65bd6c037d9.png",
    status: "active",
    addedAt: "2024-03-22T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Rivian manufactures electric SUVs, trucks, and commercial delivery vans.",
  },
  {
    symbol: "SOFIc",
    name: "SoFi Technologies",
    underlyingTicker: "SOFI",
    address: getAddress("0xb2000000000000000000003ef37a7c863dc1482a"),
    decimals: 8,
    category: "Finance",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb2000000000000000000003ef37a7c863dc1482a.png",
    status: "active",
    addedAt: "2024-03-22T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "SoFi Technologies is an American online personal finance company and digital bank.",
  },
  {
    symbol: "PYPLc",
    name: "PayPal Holdings Inc.",
    underlyingTicker: "PYPL",
    address: getAddress("0xb200000000000000000000450ad3abe5d4846c6e"),
    decimals: 8,
    category: "Finance",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb200000000000000000000450ad3abe5d4846c6e.png",
    status: "active",
    addedAt: "2024-03-22T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "PayPal operates a worldwide online payments system supporting digital transactions.",
  },
  {
    symbol: "UBERc",
    name: "Uber Technologies Inc.",
    underlyingTicker: "UBER",
    address: getAddress("0xb200000000000000000000cae20cb1446462e24c"),
    decimals: 8,
    category: "Tech",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb200000000000000000000cae20cb1446462e24c.png",
    status: "active",
    addedAt: "2024-03-22T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Uber provides ride-hailing services, food delivery (Uber Eats), and freight transport.",
  },
  {
    symbol: "WMTc",
    name: "Walmart Inc.",
    underlyingTicker: "WMT",
    address: getAddress("0xb2000000000000000000008a7508619c717a7106"),
    decimals: 8,
    category: "Consumer",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb2000000000000000000008a7508619c717a7106.png",
    status: "active",
    addedAt: "2024-03-22T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Walmart operates a global chain of hypermarkets, discount department stores, and grocery stores.",
  },
  {
    symbol: "BRK.Bc",
    name: "Berkshire Hathaway B",
    underlyingTicker: "BRK.B",
    address: getAddress("0xb20000000000000000000024170488e788cbbcb4"),
    decimals: 8,
    category: "Finance",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb20000000000000000000024170488e788cbbcb4.png",
    status: "active",
    addedAt: "2024-03-22T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Berkshire Hathaway is Warren Buffett's holding company with diversified industrial and insurance subsidiaries.",
  },
  {
    symbol: "PFEc",
    name: "Pfizer Inc.",
    underlyingTicker: "PFE",
    address: getAddress("0xb20000000000000000000018fe7ec7d6dfeeb528"),
    decimals: 8,
    category: "Healthcare",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb20000000000000000000018fe7ec7d6dfeeb528.png",
    status: "active",
    addedAt: "2024-03-22T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Pfizer is an American multinational pharmaceutical and biotechnology corporation.",
  },
  {
    symbol: "LLYc",
    name: "Eli Lilly and Co.",
    underlyingTicker: "LLY",
    address: getAddress("0xb200000000000000000000f1a0f91e34892e4718"),
    decimals: 8,
    category: "Healthcare",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb200000000000000000000f1a0f91e34892e4718.png",
    status: "active",
    addedAt: "2024-03-22T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Eli Lilly is a global healthcare leader in pharmaceutical treatments for diabetes, oncology, and immunology.",
  },
  {
    symbol: "AVGOc",
    name: "Broadcom Inc.",
    underlyingTicker: "AVGO",
    address: getAddress("0xb200000000000000000000fc737aea6196ab5a4c"),
    decimals: 8,
    category: "Tech",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb200000000000000000000fc737aea6196ab5a4c.png",
    status: "active",
    addedAt: "2024-03-22T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Broadcom designs, develops, and supplies a broad range of semiconductor and infrastructure software solutions.",
  },
  {
    symbol: "MARAc",
    name: "MARA Holdings Inc.",
    underlyingTicker: "MARA",
    address: getAddress("0xb200000000000000000000a310e034e09186fb2d"),
    decimals: 8,
    category: "Crypto-related",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb200000000000000000000a310e034e09186fb2d.png",
    status: "active",
    addedAt: "2024-03-22T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "MARA Holdings is a premier digital asset computing company supporting the Bitcoin ecosystem.",
  },
  {
    symbol: "RIOTc",
    name: "Riot Platforms Inc.",
    underlyingTicker: "RIOT",
    address: getAddress("0xb200000000000000000000bd0c7627b663c581a6"),
    decimals: 8,
    category: "Crypto-related",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb200000000000000000000bd0c7627b663c581a6.png",
    status: "active",
    addedAt: "2024-03-22T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "Riot Platforms operates Bitcoin mining facilities and electrical infrastructure in North America.",
  },
  {
    symbol: "GMEc",
    name: "GameStop Corp",
    underlyingTicker: "GME",
    address: getAddress("0xb2000000000000000000007790ed6e48e06ed935"),
    decimals: 8,
    category: "Consumer",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb2000000000000000000007790ed6e48e06ed935.png",
    status: "active",
    addedAt: "2024-03-22T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "GameStop is an American video game, consumer electronics, and gaming merchandise retailer.",
  },
  {
    symbol: "AMCc",
    name: "AMC Entertainment",
    underlyingTicker: "AMC",
    address: getAddress("0xb200000000000000000000cd7e6b8042cb7c2bb5"),
    decimals: 8,
    category: "Consumer",
    issuer: "Coinbase",
    priceFeed: {
      type: "dex",
    },
    logo: "/tokens/0xb200000000000000000000cd7e6b8042cb7c2bb5.png",
    status: "active",
    addedAt: "2024-03-22T00:00:00Z",
    restrictions: {
      transferRestricted: false,
      allowlistOnly: false,
      pausable: false,
      rebasingOrSplits: false,
    },
    description: "AMC Entertainment is the largest movie theater chain in the world.",
  },
];

// In-memory lookup maps
const REGISTRY_BY_ADDRESS = new Map<string, TokenizedStockEntry>(
  TOKENIZED_STOCKS_REGISTRY.map((s) => [s.address.toLowerCase(), s])
);

const REGISTRY_BY_SYMBOL = new Map<string, TokenizedStockEntry>(
  TOKENIZED_STOCKS_REGISTRY.map((s) => [s.symbol.toLowerCase(), s])
);

/**
 * Returns all active tokenized stocks in the registry.
 */
export function getActiveTokenizedStocks(): TokenizedStockEntry[] {
  return TOKENIZED_STOCKS_REGISTRY.filter((s) => s.status === "active");
}

/**
 * Get a tokenized stock entry by address (case-insensitive).
 */
export function getTokenizedStockByAddress(address: string): TokenizedStockEntry | null {
  if (!address) return null;
  return REGISTRY_BY_ADDRESS.get(address.trim().toLowerCase()) ?? null;
}

/**
 * Get a tokenized stock entry by symbol (case-insensitive e.g. "NVDAc" or "nvdac").
 */
export function getTokenizedStockBySymbol(symbol: string): TokenizedStockEntry | null {
  if (!symbol) return null;
  return REGISTRY_BY_SYMBOL.get(symbol.trim().toLowerCase()) ?? null;
}

/**
 * Check if an address corresponds to an ACTIVE tokenized stock in the registry.
 */
export function isActiveStockAddress(address: string): boolean {
  if (!address) return false;
  const entry = REGISTRY_BY_ADDRESS.get(address.trim().toLowerCase());
  return entry !== undefined && entry.status === "active";
}

/**
 * Check if an address is in the registry regardless of status.
 */
export function isRegisteredStockAddress(address: string): boolean {
  if (!address) return false;
  return REGISTRY_BY_ADDRESS.has(address.trim().toLowerCase());
}

/**
 * Derive dynamic category counts from the current active stock data.
 * No hardcoded counts or category lists.
 */
export function getStockCategoryCounts(): Record<StockCategory | "All", number> {
  const active = getActiveTokenizedStocks();
  const counts: Record<string, number> = {
    All: active.length,
    Tech: 0,
    Finance: 0,
    Healthcare: 0,
    Consumer: 0,
    Energy: 0,
    "Crypto-related": 0,
    "ETF/Index": 0,
    Other: 0,
  };

  for (const stock of active) {
    counts[stock.category] = (counts[stock.category] || 0) + 1;
  }

  return counts as Record<StockCategory | "All", number>;
}

/**
 * Filter stocks by category.
 */
export function getStocksByCategory(category: StockCategory | "All"): TokenizedStockEntry[] {
  const active = getActiveTokenizedStocks();
  if (category === "All") return active;
  return active.filter((s) => s.category === category);
}

/**
 * Check whether a token is recently added (within the last 7 days).
 */
export function isNewStock(addedAt: string, nowMs = Date.now()): boolean {
  try {
    const addedTime = new Date(addedAt).getTime();
    if (isNaN(addedTime)) return false;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return nowMs - addedTime <= sevenDaysMs && nowMs >= addedTime;
  } catch {
    return false;
  }
}

/**
 * Search tokenized stocks by query (ticker, symbol, name, or address).
 */
export function searchTokenizedStocks(
  query: string,
  options: {
    category?: StockCategory | "All";
    limit?: number;
    activeOnly?: boolean;
  } = {}
): TokenizedStockEntry[] {
  const { category = "All", limit = 100, activeOnly = true } = options;
  const source = activeOnly ? getActiveTokenizedStocks() : TOKENIZED_STOCKS_REGISTRY;
  const filtered = category === "All" ? source : source.filter((s) => s.category === category);

  const clean = query.trim().toLowerCase();
  if (!clean) return filtered.slice(0, limit);

  return filtered
    .filter(
      (s) =>
        s.symbol.toLowerCase().includes(clean) ||
        s.name.toLowerCase().includes(clean) ||
        s.underlyingTicker.toLowerCase().includes(clean) ||
        s.address.toLowerCase() === clean
    )
    .slice(0, limit);
}
