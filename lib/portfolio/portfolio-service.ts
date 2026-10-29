import { formatUnits, getAddress } from "viem";
import { formatTokenAmount } from "../launchpad/format";
import { TOKENIZED_STOCKS_REGISTRY } from "../stocks/tokenized-stocks-registry";
import { COMMON_BASE_TOKENS } from "../launchpad/common-tokens";
import { fetchAllUserPositions } from "../lending/user-positions";
import { discoverWalletBalances } from "./indexer";
import { batchPriceTokens } from "./pricing";
import { evaluateTokenSpam, sanitizeTokenString, DUST_USD_THRESHOLD } from "./spam-filter";
import type { PortfolioResponse, PortfolioToken, DefiPortfolioBreakdown } from "./types";
import type { SwapCounter } from "../../components/launchpad/TokenPickerDialog";
import { isVerifiedBaseToken, registerVerifiedLiquidityToken } from "../swap/verified-tokens";

// In-memory server-side cache keyed by address (TTL: 20 seconds)
const CACHE_TTL_MS = 20_000;
const cache = new Map<string, { timestamp: number; data: PortfolioResponse }>();

const STOCK_ADDRESSES = new Set(
  TOKENIZED_STOCKS_REGISTRY.map((s) => s.address.toLowerCase())
);
const VERIFIED_ADDRESSES = new Set(
  COMMON_BASE_TOKENS.map((t) => t.address.toLowerCase())
);

/**
 * Builds a valid SwapCounter object for trade execution
 */
function buildSwapCounter(
  address: `0x${string}` | null,
  symbol: string,
  decimals: number,
  logo: string | null,
  isVerified?: boolean,
  liquidityUsd?: number | null
): SwapCounter {
  if (!address || symbol === "ETH") {
    return { kind: "eth", isVerified: true, isUnverified: false };
  }
  const verified = isVerified ?? isVerifiedBaseToken(address, { liquidityUsd });
  return {
    kind: "token",
    address,
    symbol,
    decimals,
    imageUrl: logo ?? undefined,
    isVerified: verified,
    isUnverified: !verified,
    liquidityUsd: liquidityUsd ?? undefined,
  };
}

/**
 * Fetch and construct comprehensive portfolio for a wallet address on Base mainnet.
 */
export async function getWalletPortfolio(
  rawAddress: string,
  customTokenAddresses: string[] = [],
  includeDefi = true
): Promise<PortfolioResponse> {
  // 1. Validate & checksum normalized address
  const address = getAddress(rawAddress.trim());
  const cacheKey = `${address.toLowerCase()}:${customTokenAddresses.sort().join(",")}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Parse custom token addresses safely
  const validCustomAddrs: `0x${string}`[] = [];
  for (const raw of customTokenAddresses) {
    try {
      validCustomAddrs.push(getAddress(raw.trim()));
    } catch {
      // Skip invalid custom address
    }
  }

  // 2. Discover token balances (Alchemy + Blockscout + On-Chain Multicall)
  const indexerResult = await discoverWalletBalances(address, validCustomAddrs);

  // 3. Batch Price all discovered tokens
  const addressesToPrice: Array<`0x${string}` | null> = [
    null, // Native ETH
    ...indexerResult.balances.map((b) => b.address),
  ];
  const priceMap = await batchPriceTokens(addressesToPrice);

  const tokens: PortfolioToken[] = [];

  // 4. Add Native ETH if balance > 0
  if (indexerResult.nativeEthBigInt > BigInt(0)) {
    const decimals = 18;
    const balanceFormatted = formatTokenAmount(indexerResult.nativeEthBigInt, decimals);
    const balanceNumber = parseFloat(formatUnits(indexerResult.nativeEthBigInt, decimals));
    const ethPrice = priceMap.get("eth");
    const priceUsd = ethPrice?.priceUsd ?? null;
    const usdValue = priceUsd != null ? balanceNumber * priceUsd : 0;

    tokens.push({
      address: null,
      symbol: "ETH",
      name: "Ether",
      decimals,
      balanceRaw: indexerResult.nativeEthBigInt.toString(),
      balanceFormatted,
      balance: balanceNumber,
      balanceNumber,
      priceUsd,
      priceSource: ethPrice?.priceSource ?? "none",
      usdValue,
      priceChange24h: ethPrice?.priceChange24h ?? null,
      logo: "/tokens/0x0000000000000000000000000000000000000000.png",
      isSpam: false,
      isVerified: true,
      isStock: false,
      isB20: false,
      hasTradeRoute: true,
      counter: { kind: "eth" },
    });
  }

  // 5. Process ERC-20 Tokens
  for (const item of indexerResult.balances) {
    const lower = item.address.toLowerCase();
    const decimals = item.decimals ?? 18;
    const rawSym = item.symbol || "UNKNOWN";
    const rawName = item.name || rawSym;

    const symbol = sanitizeTokenString(rawSym, 12);
    const name = sanitizeTokenString(rawName, 32);

    const balanceFormatted = formatTokenAmount(item.balanceBigInt, decimals);
    const balanceNumber = parseFloat(formatUnits(item.balanceBigInt, decimals));

    if (!Number.isFinite(balanceNumber) || balanceNumber <= 0) {
      continue;
    }

    const priceInfo = priceMap.get(lower);
    const priceUsd = priceInfo?.priceUsd ?? null;
    const liquidityUsd = priceInfo?.liquidityUsd ?? null;
    const usdValue = priceUsd != null ? balanceNumber * priceUsd : 0;

    if (liquidityUsd != null && liquidityUsd >= 100_000) {
      registerVerifiedLiquidityToken(item.address, liquidityUsd);
    }

    const isStock = STOCK_ADDRESSES.has(lower);
    const isB20 = lower.startsWith("0xb20");
    const isVerified = isVerifiedBaseToken(item.address, { liquidityUsd });
    const isCustom = validCustomAddrs.some((ca) => ca.toLowerCase() === lower);

    // Spam Evaluation
    const spamCheck = evaluateTokenSpam({
      name: rawName,
      symbol: rawSym,
      address: item.address,
      hasPool: priceInfo?.hasPool,
      liquidityUsd,
      isFlaggedSpam: item.isSpam,
    });

    const isSpam = !isVerified && spamCheck.isSpam;
    const hasTradeRoute = isVerified || (priceInfo?.hasPool ?? false) || priceUsd != null;

    const logo = item.logo || `/tokens/${lower}.png`;

    tokens.push({
      address: item.address,
      symbol,
      name,
      decimals,
      balanceRaw: item.balanceBigInt.toString(),
      balanceFormatted,
      balance: balanceNumber,
      balanceNumber,
      priceUsd,
      priceSource: priceInfo?.priceSource ?? "none",
      usdValue,
      priceChange24h: priceInfo?.priceChange24h ?? null,
      liquidityUsd,
      logo,
      isSpam,
      spamReason: isSpam ? spamCheck.reason : undefined,
      isVerified,
      isStock,
      isB20,
      isCustom,
      hasTradeRoute,
      counter: buildSwapCounter(item.address, symbol, decimals, logo, isVerified, liquidityUsd),
    });
  }

  // 6. Sort tokens:
  // - Non-spam first, spam at the end
  // - Priced tokens by USD value descending
  // - Unpriced tokens by balance
  tokens.sort((a, b) => {
    if (a.isSpam !== b.isSpam) return a.isSpam ? 1 : -1;
    if (a.priceUsd != null && b.priceUsd != null) {
      return b.usdValue - a.usdValue;
    }
    if (a.priceUsd != null && b.priceUsd == null) return -1;
    if (a.priceUsd == null && b.priceUsd != null) return 1;
    return b.balanceNumber - a.balanceNumber;
  });

  // 7. Calculate Aggregates
  let totalUsd = 0;
  let pricedCount = 0;
  let unpricedCount = 0;
  let spamCount = 0;
  let dustCount = 0;

  for (const t of tokens) {
    if (t.isSpam) {
      spamCount++;
      continue;
    }
    if (t.priceUsd != null && Number.isFinite(t.usdValue)) {
      totalUsd += t.usdValue;
      pricedCount++;
      if (t.usdValue < DUST_USD_THRESHOLD && t.symbol !== "ETH") {
        dustCount++;
      }
    } else {
      unpricedCount++;
    }
  }

  // 8. DeFi Positions Breakdown (Morpho, Aave, Euler)
  let defiBreakdown: DefiPortfolioBreakdown | undefined;
  if (includeDefi) {
    try {
      const { positions } = await fetchAllUserPositions(address);
      if (positions.length > 0) {
        let supplied = 0;
        let borrowed = 0;
        const posSummary = positions.map((p) => {
          supplied += p.suppliedUsd || 0;
          borrowed += p.borrowedUsd || 0;
          return {
            protocol: p.protocolName,
            assetSymbol: p.assetSymbol,
            type: p.type,
            amountFormatted: p.suppliedFormatted || p.borrowedFormatted || "0",
            usdValue: p.suppliedUsd || p.borrowedUsd || 0,
          };
        });
        defiBreakdown = {
          totalSuppliedUsd: supplied,
          totalBorrowedUsd: borrowed,
          netUsd: supplied - borrowed,
          positionsCount: positions.length,
          positions: posSummary,
        };
      }
    } catch {
      // Ignore DeFi positions fetch failures
    }
  }

  const response: PortfolioResponse = {
    address,
    chainId: 8453,
    chainName: "Base",
    tokens,
    totalUsd: parseFloat(totalUsd.toFixed(2)),
    pricedCount,
    unpricedCount,
    spamCount,
    dustCount,
    totalCount: tokens.length,
    defi: defiBreakdown,
    updatedAt: Date.now(),
    partial: indexerResult.partial,
    warning: indexerResult.warning,
  };

  cache.set(cacheKey, { timestamp: Date.now(), data: response });
  return response;
}
