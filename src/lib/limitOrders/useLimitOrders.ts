"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type Address,
  encodeFunctionData,
  parseAbi,
} from "viem";
import { useAccount, useChainId } from "wagmi";
import { orderBookAbi } from "./abi";
import {
  buildApproveCall,
  buildCreateOrderCall,
  buildCreateTrailingStopCall,
  buildCreateBracketCall,
  buildUpdateOrderCall,
  buildCancelOrderCall,
  buildRefundExpiredCall,
  buildCreateDcaCall,
  buildCancelDcaCall,
} from "./calls";
import {
  getLimitOrdersConfig,
  type StockMarketConfig,
  DEFAULT_KEEPER_FEE_BPS,
  DEFAULT_MAX_DEVIATION_BPS,
} from "@/src/config/limitOrders";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { buildContractCall } from "@/lib/utils/tx";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { OnChainOrder, OnChainPlan, GroupedOrderItem } from "./types";
import { groupOrders } from "./bracketGrouping";
import { mapOrderError } from "./errorMapper";

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

export interface MarketState extends StockMarketConfig {
  currentPrice: bigint | null;
  updatedAt: number;
  isStale: boolean;
  enabled: boolean;
  maxStockIn: bigint;
  maxQuoteIn: bigint;
  maxDeviationBps: number;
  userBalance: bigint;
  userAllowance: bigint;
}

export function useLimitOrders(app: WalletAppState) {
  const account = useAccount();
  const currentChainId = useChainId();
  const chainId = account.chainId || currentChainId || 8453;
  const config = useMemo(() => getLimitOrdersConfig(chainId), [chainId]);

  const walletAddress = app.wallet?.address as Address | undefined;

  const [_loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keeperFeeBps, setKeeperFeeBps] = useState<number>(DEFAULT_KEEPER_FEE_BPS);
  const [quoteBalance, setQuoteBalance] = useState<bigint>(0n);
  const [quoteAllowance, setQuoteAllowance] = useState<bigint>(0n);
  const [marketStates, setMarketStates] = useState<Record<string, MarketState>>({});
  const [openOrders, setOpenOrders] = useState<GroupedOrderItem[]>([]);
  const [historyOrders, setHistoryOrders] = useState<GroupedOrderItem[]>([]);
  const [plans, setPlans] = useState<OnChainPlan[]>([]);
  const [regionRestricted, setRegionRestricted] = useState(false);
  const [regionCountry, setRegionCountry] = useState<string | null>(null);
  const [txSubmitting, setTxSubmitting] = useState(false);
  const [txSuccessHash, setTxSuccessHash] = useState<string | null>(null);

  const publicClient = useMemo(() => createBasePublicClient(), []);

  // 1. Fetch region check
  useEffect(() => {
    let unmounted = false;
    async function checkRegion() {
      try {
        const res = await fetch("/api/limit-orders/region-check", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (!unmounted) {
            setRegionRestricted(Boolean(data.restricted));
            setRegionCountry(data.country || null);
          }
        }
      } catch {
        // development fallback
      }
    }
    checkRegion();
    return () => {
      unmounted = true;
    };
  }, []);

  // 2. Main data loader
  const loadData = useCallback(async () => {
    if (!config.orderBook || config.orderBook === "0x0000000000000000000000000000000000000000") {
      return;
    }

    try {
      setLoading(true);

      // Check contract paused & keeper fee
      try {
        const [isPaused, fee] = await Promise.all([
          publicClient.readContract({
            address: config.orderBook,
            abi: orderBookAbi,
            functionName: "paused",
          }),
          publicClient.readContract({
            address: config.orderBook,
            abi: orderBookAbi,
            functionName: "keeperFeeBps",
          }),
        ]);
        setPaused(Boolean(isPaused));
        setKeeperFeeBps(Number(fee));
      } catch {
        // Contract may not be deployed on chain yet
      }

      // Check Quote token balance & allowance
      if (walletAddress && config.quoteToken.address) {
        try {
          const [bal, allow] = await Promise.all([
            publicClient.readContract({
              address: config.quoteToken.address,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [walletAddress],
            }),
            publicClient.readContract({
              address: config.quoteToken.address,
              abi: ERC20_ABI,
              functionName: "allowance",
              args: [walletAddress, config.orderBook],
            }),
          ]);
          setQuoteBalance(bal);
          setQuoteAllowance(allow);
        } catch {
          // ignore
        }
      }

      // Check each Market
      const newMarkets: Record<string, MarketState> = {};
      const nowSec = Math.floor(Date.now() / 1000);

      await Promise.all(
        config.markets.map(async (m) => {
          let currentPrice: bigint | null = null;
          let updatedAt = 0;
          let isStale = false;
          let enabled = true;
          let maxStockIn = config.maxStockIn;
          let maxQuoteIn = config.maxQuoteIn;
          let maxDeviationBps = config.defaultMaxDeviationBps || DEFAULT_MAX_DEVIATION_BPS;
          let userBalance = 0n;
          let userAllowance = 0n;

          try {
            // Read market on-chain config
            const marketInfo = await publicClient.readContract({
              address: config.orderBook,
              abi: orderBookAbi,
              functionName: "markets",
              args: [m.stockToken],
            });

            if (marketInfo) {
              const info = marketInfo as unknown as [
                Address,
                number,
                number,
                boolean,
                number,
                number,
                Address,
                bigint,
                bigint,
              ] & {
                enabled?: boolean;
                maxStockIn?: bigint;
                maxQuoteIn?: bigint;
                maxDeviationBps?: number;
              };
              enabled = info.enabled != null ? Boolean(info.enabled) : Boolean(info[3]);
              const onChainMaxStock = info.maxStockIn != null ? BigInt(info.maxStockIn) : BigInt(info[7]);
              const onChainMaxQuote = info.maxQuoteIn != null ? BigInt(info.maxQuoteIn) : BigInt(info[8]);
              const onChainDev = info.maxDeviationBps != null ? Number(info.maxDeviationBps) : Number(info[5]);

              if (onChainMaxStock > 0n) maxStockIn = onChainMaxStock;
              if (onChainMaxQuote > 0n) maxQuoteIn = onChainMaxQuote;
              if (onChainDev > 0) maxDeviationBps = onChainDev;
            }
          } catch {
            // ignore
          }

          try {
            // Read current price
            const priceRes = await publicClient.readContract({
              address: config.orderBook,
              abi: orderBookAbi,
              functionName: "currentPrice",
              args: [m.stockToken],
            });
            if (priceRes) {
              currentPrice = priceRes[0];
              updatedAt = Number(priceRes[1]);
              isStale = nowSec - updatedAt > m.maxStalenessSeconds;
            }
          } catch {
            // Mock / fallback if market price not populated
          }

          if (walletAddress) {
            try {
              const [sBal, sAllow] = await Promise.all([
                publicClient.readContract({
                  address: m.stockToken,
                  abi: ERC20_ABI,
                  functionName: "balanceOf",
                  args: [walletAddress],
                }),
                publicClient.readContract({
                  address: m.stockToken,
                  abi: ERC20_ABI,
                  functionName: "allowance",
                  args: [walletAddress, config.orderBook],
                }),
              ]);
              userBalance = sBal;
              userAllowance = sAllow;
            } catch {
              // ignore
            }
          }

          newMarkets[m.stockToken.toLowerCase()] = {
            ...m,
            currentPrice,
            updatedAt,
            isStale,
            enabled,
            maxStockIn,
            maxQuoteIn,
            maxDeviationBps,
            userBalance,
            userAllowance,
          };
        })
      );
      setMarketStates(newMarkets);

      // Fetch User Orders and Plans
      if (walletAddress) {
        try {
          const [orderIds, planIds] = await Promise.all([
            publicClient.readContract({
              address: config.orderBook,
              abi: orderBookAbi,
              functionName: "ordersOf",
              args: [walletAddress],
            }),
            publicClient.readContract({
              address: config.orderBook,
              abi: orderBookAbi,
              functionName: "plansOf",
              args: [walletAddress],
            }),
          ]);

          if (orderIds && orderIds.length > 0) {
            const rawOrders: OnChainOrder[] = [];
            await Promise.all(
              orderIds.map(async (id) => {
                try {
                  const o = await publicClient.readContract({
                    address: config.orderBook,
                    abi: orderBookAbi,
                    functionName: "getOrder",
                    args: [id],
                  });
                  if (o) {
                    rawOrders.push({
                      id,
                      owner: o.owner,
                      expiry: Number(o.expiry),
                      orderType: Number(o.orderType),
                      status: Number(o.status),
                      trailBps: Number(o.trailBps),
                      stockToken: o.stockToken,
                      triggerPrice: o.triggerPrice,
                      amountIn: o.amountIn,
                      minAmountOut: o.minAmountOut,
                      peakPrice: o.peakPrice,
                      linkedId: o.linkedId,
                    });
                  }
                } catch {
                  // ignore
                }
              })
            );
            const grouped = groupOrders(rawOrders);
            setOpenOrders(grouped.open);
            setHistoryOrders(grouped.history);
          } else {
            setOpenOrders([]);
            setHistoryOrders([]);
          }

          if (planIds && planIds.length > 0) {
            const rawPlans: OnChainPlan[] = [];
            await Promise.all(
              planIds.map(async (id) => {
                try {
                  const p = await publicClient.readContract({
                    address: config.orderBook,
                    abi: orderBookAbi,
                    functionName: "getPlan",
                    args: [id],
                  });
                  if (p) {
                    rawPlans.push({
                      id,
                      owner: p.owner,
                      status: Number(p.status),
                      remaining: Number(p.remaining),
                      interval: Number(p.interval),
                      nextTime: Number(p.nextTime),
                      stockToken: p.stockToken,
                      maxPrice: p.maxPrice,
                      amountPerBuy: p.amountPerBuy,
                    });
                  }
                } catch {
                  // ignore
                }
              })
            );
            rawPlans.sort((a, b) => (b.id > a.id ? 1 : -1));
            setPlans(rawPlans);
          } else {
            setPlans([]);
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [config, publicClient, walletAddress]);

  // 3. Polling every 15 seconds while mounted
  useEffect(() => {
    void loadData();
    const interval = setInterval(() => {
      void loadData();
    }, 15_000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Actions
  const approveToken = useCallback(
    async (tokenAddress: Address, amount: bigint, label: string) => {
      if (!walletAddress || !config.orderBook || !app.connType) return false;
      try {
        setTxSubmitting(true);
        const req = buildApproveCall(tokenAddress, config.orderBook, amount);
        const hash = await sendAppTransactions(
          app.connType,
          walletAddress,
          [buildContractCall(req.to, req.data, req.value ?? 0n)]
        );
        if (hash) {
          app.showToast(`Approved ${label}`, hash);
          await loadData();
          return true;
        }
        return false;
      } catch (err) {
        app.showToast(mapOrderError(err), "");
        return false;
      } finally {
        setTxSubmitting(false);
      }
    },
    [app, config.orderBook, loadData, walletAddress]
  );

  const placeOrder = useCallback(
    async (args: {
      stockToken: Address;
      orderType: number;
      amountIn: bigint;
      triggerPrice: bigint;
      minAmountOut: bigint;
      expiry: number;
      label: string;
    }) => {
      if (!walletAddress || !config.orderBook || !app.connType) return null;
      try {
        setTxSubmitting(true);
        const req = buildCreateOrderCall({
          orderBook: config.orderBook,
          stockToken: args.stockToken,
          orderType: args.orderType,
          amountIn: args.amountIn,
          triggerPrice: args.triggerPrice,
          minAmountOut: args.minAmountOut,
          expiry: args.expiry,
        });
        const hash = await sendAppTransactions(
          app.connType,
          walletAddress,
          [buildContractCall(req.to, req.data, req.value ?? 0n)]
        );
        if (hash) {
          setTxSuccessHash(hash);
          app.showToast(`${args.label} placed successfully!`, hash);
          await loadData();
          return hash;
        }
        return null;
      } catch (err) {
        app.showToast(mapOrderError(err), "");
        return null;
      } finally {
        setTxSubmitting(false);
      }
    },
    [app, config.orderBook, loadData, walletAddress]
  );

  const placeTrailingStop = useCallback(
    async (args: {
      stockToken: Address;
      amountIn: bigint;
      trailBps: number;
      minAmountOut: bigint;
      expiry: number;
    }) => {
      if (!walletAddress || !config.orderBook || !app.connType) return null;
      try {
        setTxSubmitting(true);
        const req = buildCreateTrailingStopCall({
          orderBook: config.orderBook,
          stockToken: args.stockToken,
          amountIn: args.amountIn,
          trailBps: args.trailBps,
          minAmountOut: args.minAmountOut,
          expiry: args.expiry,
        });
        const hash = await sendAppTransactions(
          app.connType,
          walletAddress,
          [buildContractCall(req.to, req.data, req.value ?? 0n)]
        );
        if (hash) {
          setTxSuccessHash(hash);
          app.showToast("Trailing stop placed successfully!", hash);
          await loadData();
          return hash;
        }
        return null;
      } catch (err) {
        app.showToast(mapOrderError(err), "");
        return null;
      } finally {
        setTxSubmitting(false);
      }
    },
    [app, config.orderBook, loadData, walletAddress]
  );

  const placeBracket = useCallback(
    async (args: {
      stockToken: Address;
      amountIn: bigint;
      takeProfitPrice: bigint;
      stopLossPrice: bigint;
      minOutTakeProfit: bigint;
      minOutStopLoss: bigint;
      expiry: number;
    }) => {
      if (!walletAddress || !config.orderBook || !app.connType) return null;
      try {
        setTxSubmitting(true);
        const req = buildCreateBracketCall({
          orderBook: config.orderBook,
          stockToken: args.stockToken,
          amountIn: args.amountIn,
          takeProfitPrice: args.takeProfitPrice,
          stopLossPrice: args.stopLossPrice,
          minOutTakeProfit: args.minOutTakeProfit,
          minOutStopLoss: args.minOutStopLoss,
          expiry: args.expiry,
        });
        const hash = await sendAppTransactions(
          app.connType,
          walletAddress,
          [buildContractCall(req.to, req.data, req.value ?? 0n)]
        );
        if (hash) {
          setTxSuccessHash(hash);
          app.showToast("Bracket order placed successfully!", hash);
          await loadData();
          return hash;
        }
        return null;
      } catch (err) {
        app.showToast(mapOrderError(err), "");
        return null;
      } finally {
        setTxSubmitting(false);
      }
    },
    [app, config.orderBook, loadData, walletAddress]
  );

  const updateOrder = useCallback(
    async (id: bigint, newTriggerPrice: bigint, newMinAmountOut: bigint) => {
      if (!walletAddress || !config.orderBook || !app.connType) return false;
      try {
        setTxSubmitting(true);
        const req = buildUpdateOrderCall({
          orderBook: config.orderBook,
          orderId: id,
          newTrigger: newTriggerPrice,
          newMinAmountOut,
        });
        const hash = await sendAppTransactions(
          app.connType,
          walletAddress,
          [buildContractCall(req.to, req.data, req.value ?? 0n)]
        );
        if (hash) {
          app.showToast(`Order #${id} updated successfully!`, hash);
          await loadData();
          return true;
        }
        return false;
      } catch (err) {
        app.showToast(mapOrderError(err), "");
        return false;
      } finally {
        setTxSubmitting(false);
      }
    },
    [app, config.orderBook, loadData, walletAddress]
  );

  const cancelOrder = useCallback(
    async (id: bigint) => {
      if (!walletAddress || !config.orderBook || !app.connType) return false;
      try {
        setTxSubmitting(true);
        const req = buildCancelOrderCall(config.orderBook, id);
        const hash = await sendAppTransactions(
          app.connType,
          walletAddress,
          [buildContractCall(req.to, req.data, req.value ?? 0n)]
        );
        if (hash) {
          app.showToast(`Order #${id} cancelled and refunded.`, hash);
          await loadData();
          return true;
        }
        return false;
      } catch (err) {
        app.showToast(mapOrderError(err), "");
        return false;
      } finally {
        setTxSubmitting(false);
      }
    },
    [app, config.orderBook, loadData, walletAddress]
  );

  const refundExpired = useCallback(
    async (id: bigint) => {
      if (!walletAddress || !config.orderBook || !app.connType) return false;
      try {
        setTxSubmitting(true);
        const req = buildRefundExpiredCall(config.orderBook, id);
        const hash = await sendAppTransactions(
          app.connType,
          walletAddress,
          [buildContractCall(req.to, req.data, req.value ?? 0n)]
        );
        if (hash) {
          app.showToast(`Expired order #${id} refunded.`, hash);
          await loadData();
          return true;
        }
        return false;
      } catch (err) {
        app.showToast(mapOrderError(err), "");
        return false;
      } finally {
        setTxSubmitting(false);
      }
    },
    [app, config.orderBook, loadData, walletAddress]
  );

  const createDca = useCallback(
    async (args: {
      stockToken: Address;
      amountPerBuy: bigint;
      buys: number;
      interval: number;
      maxPrice: bigint;
    }) => {
      if (!walletAddress || !config.orderBook || !app.connType) return null;
      try {
        setTxSubmitting(true);
        const req = buildCreateDcaCall({
          orderBook: config.orderBook,
          stockToken: args.stockToken,
          amountPerBuy: args.amountPerBuy,
          buys: args.buys,
          interval: args.interval,
          maxPrice: args.maxPrice,
        });
        const hash = await sendAppTransactions(
          app.connType,
          walletAddress,
          [buildContractCall(req.to, req.data, req.value ?? 0n)]
        );
        if (hash) {
          setTxSuccessHash(hash);
          app.showToast("Recurring buy plan started successfully!", hash);
          await loadData();
          return hash;
        }
        return null;
      } catch (err) {
        app.showToast(mapOrderError(err), "");
        return null;
      } finally {
        setTxSubmitting(false);
      }
    },
    [app, config.orderBook, loadData, walletAddress]
  );

  const cancelDca = useCallback(
    async (id: bigint) => {
      if (!walletAddress || !config.orderBook || !app.connType) return false;
      try {
        setTxSubmitting(true);
        const req = buildCancelDcaCall(config.orderBook, id);
        const hash = await sendAppTransactions(
          app.connType,
          walletAddress,
          [buildContractCall(req.to, req.data, req.value ?? 0n)]
        );
        if (hash) {
          app.showToast(`DCA plan #${id} cancelled and unspent funds refunded.`, hash);
          await loadData();
          return true;
        }
        return false;
      } catch (err) {
        app.showToast(mapOrderError(err), "");
        return false;
      } finally {
        setTxSubmitting(false);
      }
    },
    [app, config.orderBook, loadData, walletAddress]
  );

  return {
    config,
    chainId,
    walletAddress,
    paused,
    keeperFeeBps,
    quoteBalance,
    quoteAllowance,
    marketStates,
    openOrders,
    historyOrders,
    plans,
    regionRestricted,
    regionCountry,
    txSubmitting,
    txSuccessHash,
    setTxSuccessHash,
    refresh: loadData,
    approveToken,
    placeOrder,
    placeTrailingStop,
    placeBracket,
    updateOrder,
    cancelOrder,
    refundExpired,
    createDca,
    cancelDca,
  };
}
