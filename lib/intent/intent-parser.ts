/**
 * Intent Parser for Base Terminal's Spotlight Command Palette
 * Translates natural-language user commands into deep-linked app destinations.
 */

export interface ParsedIntent {
  type: "swap" | "gift" | "launch" | "lend" | "profile";
  label: string;
  description: string;
  actionText: string;
  href: string;
  tab: "swap" | "basehub" | "launchpad" | "lend" | "profile";
  params?: {
    buy?: string;
    sell?: string;
    amount?: string;
    asset?: string;
  };
}

const KNOWN_TOKENS: Record<string, string> = {
  eth: "ETH",
  weth: "0x4200000000000000000000000000000000000006",
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  cbeth: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
  degen: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
  virtual: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
  aero: "0x940181A94A35a4569e4529A3cDfB74E48Fd98762",
  toshi: "0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4",
  brett: "0x532f27101965dd16442E59d40670FaF5eBB142E4",
};

export function parseIntent(query: string): ParsedIntent | null {
  const q = query.trim();
  if (!q) return null;

  // 1. SWAP INTENT: "swap 50 USDC to ETH", "trade 100 eth for usdc", "buy 500 degen"
  const swapPairRegex = /^(?:swap|trade|exchange)\s+([0-9.]+)?\s*([a-zA-Z0-9]+)\s+(?:to|for)\s+([a-zA-Z0-9]+)$/i;
  const swapPairMatch = q.match(swapPairRegex);
  if (swapPairMatch) {
    const amount = swapPairMatch[1] || "";
    const sellSym = swapPairMatch[2].toUpperCase();
    const buySym = swapPairMatch[3].toUpperCase();

    const sellAddr = KNOWN_TOKENS[sellSym.toLowerCase()] ?? sellSym;
    const buyAddr = KNOWN_TOKENS[buySym.toLowerCase()] ?? buySym;

    const href = `/swap?sell=${encodeURIComponent(sellAddr)}&buy=${encodeURIComponent(buyAddr)}${
      amount ? `&amount=${encodeURIComponent(amount)}` : ""
    }`;

    return {
      type: "swap",
      label: `Swap ${amount ? `${amount} ` : ""}${sellSym} → ${buySym}`,
      description: `Open DexSwap with ${amount || "entered"} ${sellSym} ready to swap for ${buySym}`,
      actionText: "Execute Swap",
      href,
      tab: "swap",
      params: { sell: sellAddr, buy: buyAddr, amount },
    };
  }

  // 1b. Single token swap: "swap 50 usdc", "trade eth"
  const swapSingleRegex = /^(?:swap|trade)\s+([0-9.]+)\s*([a-zA-Z0-9]+)$/i;
  const swapSingleMatch = q.match(swapSingleRegex);
  if (swapSingleMatch) {
    const amount = swapSingleMatch[1];
    const sellSym = swapSingleMatch[2].toUpperCase();
    const sellAddr = KNOWN_TOKENS[sellSym.toLowerCase()] ?? sellSym;

    return {
      type: "swap",
      label: `Swap ${amount} ${sellSym}`,
      description: `Open DexSwap prefilled with ${amount} ${sellSym}`,
      actionText: "Prepare Swap",
      href: `/swap?sell=${encodeURIComponent(sellAddr)}&amount=${encodeURIComponent(amount)}`,
      tab: "swap",
      params: { sell: sellAddr, amount },
    };
  }

  // 1c. Buy token: "buy 50 degen", "buy eth"
  const buyRegex = /^buy\s+([0-9.]+)?\s*([a-zA-Z0-9]+)$/i;
  const buyMatch = q.match(buyRegex);
  if (buyMatch) {
    const amount = buyMatch[1] || "";
    const buySym = buyMatch[2].toUpperCase();
    const buyAddr = KNOWN_TOKENS[buySym.toLowerCase()] ?? buySym;

    return {
      type: "swap",
      label: `Buy ${amount ? `${amount} ` : ""}${buySym}`,
      description: `Open DexSwap to purchase ${buySym} with ETH/USDC`,
      actionText: "Buy on Base",
      href: `/swap?buy=${encodeURIComponent(buyAddr)}${amount ? `&amount=${encodeURIComponent(amount)}` : ""}`,
      tab: "swap",
      params: { buy: buyAddr, amount },
    };
  }

  // 2. GIFT / VOUCHER INTENT: "gift 10 USDC", "gift 25", "voucher 50 usdc", "create voucher"
  const giftRegex = /^(?:gift|voucher|capsule|send gift)\s*([0-9.]+)?\s*([a-zA-Z0-9]+)?$/i;
  const giftMatch = q.match(giftRegex);
  if (giftMatch && (giftMatch[1] || giftMatch[2] || /^create voucher$/i.test(q))) {
    const amount = giftMatch[1] || "10";
    const asset = giftMatch[2]?.toUpperCase() || "USDC";
    const href = `/?tab=basehub&create=1&asset=${encodeURIComponent(asset)}&total=${encodeURIComponent(amount)}&cards=1`;

    return {
      type: "gift",
      label: `Gift ${amount} ${asset} Capsule`,
      description: `Create an onchain Base gift voucher card for ${amount} ${asset}`,
      actionText: "Create Voucher",
      href,
      tab: "basehub",
      params: { amount, asset },
    };
  }

  // 3. LAUNCH INTENT: "launch token", "create token", "deploy token", "launch"
  if (/^(?:launch(?: token)?|create token|deploy token|new token)$/i.test(q)) {
    return {
      type: "launch",
      label: "Launch Fair-Launch Token",
      description: "Deploy token with anti-snipe protection and Uniswap/Aerodrome LP",
      actionText: "Open Token Launcher",
      href: "/launch",
      tab: "launchpad",
    };
  }

  // 4. LEND / STAKE INTENT: "lend", "stake", "yield", "stake usdc", "apy calculator"
  const lendRegex = /^(?:lend|stake|staking|yield|vaults?|apy calculator)(?:\s+([a-zA-Z0-9]+))?$/i;
  const lendMatch = q.match(lendRegex);
  if (lendMatch) {
    const asset = lendMatch[1]?.toUpperCase();
    return {
      type: "lend",
      label: asset ? `Lend & Stake ${asset}` : "Lend & Stake Yields",
      description: asset
        ? `Compare highest APY for ${asset} across Morpho, Aerodrome, Beefy & Moonwell`
        : "Simulate compound returns across verified Base lending & vault protocols",
      actionText: "Explore Yields",
      href: "/lend",
      tab: "lend",
      params: asset ? { asset } : undefined,
    };
  }

  // 5. PROFILE / STREAK / HABITS INTENT: "profile", "streak", "daily streak", "check in", "gm"
  if (/^(?:profile|streak|daily streak|daily check-?in|gm|gn|check-?in)$/i.test(q)) {
    return {
      type: "profile",
      label: "Daily Actions & Streaks",
      description: "Check in on Base, claim daily streak boosts, and view your onchain activity score",
      actionText: "Open Profile",
      href: "/profile",
      tab: "profile",
    };
  }

  return null;
}
