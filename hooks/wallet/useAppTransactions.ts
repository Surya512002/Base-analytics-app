import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import type { WalletData, ConnectionType } from "@/lib/types/wallet";
import type { SeedDex } from "@/lib/launchpad/seed-liquidity";
import type { LaunchTokenType } from "@/lib/launchpad/types";
import type { LaunchDex } from "@/lib/launchpad/dex";
import { USDC_BASE, USDC_DECIMALS, type SwapAsset } from "@/lib/launchpad/tokens-base";
import {
  buildB20Call,
  buildContractCall,
  buildExternalSwapCall,
  buildNativeTransferCall,
} from "@/lib/utils/tx";
import {
  resolveActiveConnType,
  persistConnType,
} from "@/lib/utils/wallet-connection";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { preflightB20Launch, simulateB20Create } from "@/lib/b20/preflight";
import { LAUNCHPAD_TREASURY } from "@/lib/constants/launchpad";
import { splitGrossAmount } from "@/lib/launchpad/fees";
import { splitPlatformFee } from "@/lib/launchpad/fee-split";
import {
  encodeCreateB20Calldata,
  encodeB20ApproveCalldata,
  mergeMintAllocations,
  predictB20Address,
  encodeErc20TransferCalldata,
  type MintAllocation,
} from "@/lib/b20/encode";
import { fetchErc20Decimals } from "@/lib/launchpad/erc20-meta";
import {
  extractB20TokenFromReceipt,
  isInvalidLaunchTokenAddress,
} from "@/lib/b20/launch-receipt";
import {
  encodeExactInputSingle,
  encodeExactInputSingleToEth,
  encodeExactInputMultiHop,
  encodeExactInputMultiHopToEth,
  encodeWethWithdrawCalldata,
  SWAP_ROUTER_02,
  WETH_BASE,
} from "@/lib/launchpad/uniswap";
import { routerHasCode } from "@/lib/launchpad/router-guard";
import {
  encodeAerodromeBuy,
  encodeAerodromeSell,
  encodeAerodromeTokensForTokens,
  AERODROME_ROUTER,
} from "@/lib/launchpad/aerodrome";
import {
  encodeSlipstreamBuy,
  encodeSlipstreamSell,
} from "@/lib/launchpad/slipstream";
import { dexLabel } from "@/lib/launchpad/dex";
import {
  buildSeedLiquidityCalls,
  computeLiquiditySeedAmounts,
  seedDexLabel,
} from "@/lib/launchpad/seed-liquidity";
import {
  registerLaunchedToken,
  fetchSwapQuote,
  fetchB20ActivationStatus,
} from "@/lib/api/launchpad-client";
import {
  createBasePublicClient,
  createPublicOnlyBaseClient,
  isRpcInfrastructureError,
  withRpcRetry,
} from "@/lib/utils/base-rpc";
import { bumpWeeklyTxKey } from "@/lib/utils/wallet-session";
import {
  recordConfirmedInAppAction,
  recordInAppTransaction,
} from "@/lib/utils/daily-points";
import { BASE_RPC } from "@/lib/constants/env";
import { ERC20_ABI } from "@/lib/constants/contracts";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";
import { parseUnits, parseEther } from "viem";

export function pushFeeSplitCalls(
  calls: ReturnType<typeof buildContractCall>[],
  fee: bigint,
  opts: {
    native: boolean;
    token: `0x${string}`;
    creator?: `0x${string}` | null;
    referrer?: `0x${string}` | null;
    referrerBoostBps?: number;
    /** Skip fee transfers back to the payer (avoids a useless self-send popup). */
    payer?: `0x${string}`;
  }
) {
  if (fee <= BigInt(0)) return;

  const skipSelf = (to: string) =>
    Boolean(opts.payer && to.toLowerCase() === opts.payer.toLowerCase());

  if (!opts.creator) {
    if (opts.native) {
      if (!skipSelf(LAUNCHPAD_TREASURY)) {
        calls.push(buildNativeTransferCall(LAUNCHPAD_TREASURY, fee));
      }
    } else {
      calls.push(
        buildContractCall(opts.token, encodeErc20TransferCalldata(LAUNCHPAD_TREASURY, fee))
      );
    }
    return;
  }

  const split = splitPlatformFee(fee, {
    creator: opts.creator,
    referrer: opts.referrer ?? null,
    referrerBoostBps: opts.referrerBoostBps,
  });
  for (const t of split.transfers) {
    if (skipSelf(t.to)) continue;
    if (opts.native) {
      calls.push(buildNativeTransferCall(t.to, t.amount));
    } else {
      calls.push(buildContractCall(opts.token, encodeErc20TransferCalldata(t.to, t.amount)));
    }
  }
}

export interface UseAppTransactionsOptions {
  wallet: WalletData | null;
  connType: ConnectionType | null;
  setConnType: Dispatch<SetStateAction<ConnectionType | null>>;
  showToast: (msg: string, hash: string) => void;
  setPointsRevision: Dispatch<SetStateAction<number>>;
  setTxKeys: Dispatch<SetStateAction<Record<string, number>>>;
  setSponsored?: Dispatch<SetStateAction<number>>;
  siweAuthenticated?: boolean;
  siweSignIn?: () => Promise<{ ok: boolean; error?: string }>;
}

export function useAppTransactions({
  wallet,
  connType,
  setConnType,
  showToast,
  setPointsRevision,
  setTxKeys,
  setSponsored,
  siweAuthenticated,
  siweSignIn,
}: UseAppTransactionsOptions) {
  const [launchLoading, setLaunchLoading] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [b20Activated, setB20Activated] = useState<boolean | null>(null);

  useEffect(() => {
    void fetchB20ActivationStatus().then(setB20Activated);
  }, []);

  const handleLaunchB20 = useCallback(
    async (args: {
      name: string;
      symbol: string;
      decimals: number;
      supplyCap: string;
      salt: `0x${string}`;
      imageUrl?: string;
      description?: string;
      website?: string;
      twitter?: string;
      telegram?: string;
      discord?: string;
      metadataEditable?: boolean;
      /** Vanity grind preview — fallback if RPC address prediction fails */
      predictedAddress?: string;
      mints: MintAllocation[];
      poolSeedPct?: number;
      quoteToken?: string;
      startPriceUsd?: string;
      launchPreset?: string;
      vestingSchedule?: Array<{
        address: string;
        pct: number;
        cliffMonths: number;
        vestMonths: number;
      }>;
      antiSnipeBlocks?: number;
      seedLiquidityEth?: string;
      autoSeedLiquidity?: boolean;
      seedDex?: SeedDex;
      ethUsd?: number;
      tokenType?: LaunchTokenType;
      quoteAsset?: string;
      quoteAssetAddress?: string;
      quoteAssetSymbol?: string;
      liquidityLocked?: boolean;
      lockerAddress?: string;
    }): Promise<{
      ok: boolean;
      address?: string;
      symbol?: string;
      name?: string;
      imageUrl?: string;
      txHash?: string;
    }> => {
      if (!wallet) return { ok: false };

      setLaunchLoading(true);
      try {
        // Catalog registration requires SIWE — sign in before launch so fees bind to creator.
        if (!siweAuthenticated && siweSignIn) {
          const signed = await siweSignIn();
          if (!signed.ok) {
            showToast(
              signed.error === "Sign-in cancelled"
                ? "Sign in required to launch and claim creator fees"
                : signed.error || "Sign in required to launch",
              ""
            );
            return { ok: false };
          }
        }

        const activated = await fetchB20ActivationStatus();
        setB20Activated(activated);
        if (!activated) {
          showToast("B20 is not activated on Base mainnet yet", "");
          return { ok: false };
        }

        const activeConn = await resolveActiveConnType(connType, wallet.address);
        if (activeConn && activeConn !== connType) {
          setConnType(activeConn);
          persistConnType(activeConn);
        }
        if (!activeConn) {
          showToast("❌ Reconnect wallet to launch", "");
          return { ok: false };
        }

        const creator = wallet.address as `0x${string}`;

        let seedEthWei = BigInt(0);
        if (
          args.autoSeedLiquidity !== false &&
          args.seedLiquidityEth &&
          args.startPriceUsd
        ) {
          try {
            seedEthWei = parseEther(args.seedLiquidityEth);
          } catch {
            seedEthWei = BigInt(0);
          }
        }

        const preflight = await preflightB20Launch(creator, { seedEthWei });
        if (!preflight.hasMinGas) {
          const bal = Number(preflight.balanceEth);
          showToast(
            `Need ≥${preflight.minEth} ETH on Base (gas${seedEthWei > BigInt(0) ? " + liquidity seed" : ""}). Balance: ${bal.toFixed(6)} ETH`,
            ""
          );
          return { ok: false };
        }

        const supplyCap = parseUnits(args.supplyCap, args.decimals);
        const mergedMints = mergeMintAllocations(args.mints);
        const mintTotal = mergedMints.reduce((s, m) => s + m.amount, BigInt(0));
        if (mintTotal > supplyCap) {
          showToast("Allocations exceed fixed 1B supply", "");
          return { ok: false };
        }

        const salt = args.salt;

        let tokenAddr: `0x${string}` =
          (await predictB20Address(creator, salt)) ??
          (args.predictedAddress?.startsWith("0x")
            ? (args.predictedAddress as `0x${string}`)
            : (`0xB2000000000000000000000000000000000000` as `0x${string}`));

        const createData = encodeCreateB20Calldata({
          name: args.name,
          symbol: args.symbol,
          creator,
          decimals: args.decimals,
          supplyCap,
          salt,
          adminless: true,
          metadataEditable: args.metadataEditable,
          description: args.description,
          website: args.website,
          twitter: args.twitter,
          telegram: args.telegram,
          discord: args.discord,
          mints: mergedMints,
        });

        const createCall = buildB20Call(B20_FACTORY_ADDRESS, createData);

        const simulation = await simulateB20Create(creator, createData);
        if (!simulation.ok) {
          showToast(simulation.reason, "");
          return { ok: false };
        }

        const hash = await sendAppTransactions(activeConn, wallet.address, [createCall]);

        let launchBlock: number | undefined;
        let receipt: import("viem").TransactionReceipt | null = null;
        try {
          const pub = createPublicOnlyBaseClient();
          receipt = await withRpcRetry(() =>
            pub.getTransactionReceipt({ hash: hash as `0x${string}` })
          );
          if (!receipt || receipt.status !== "success") {
            throw new Error(
              "Token launch reverted — check allocations and retry with a new salt"
            );
          }
          launchBlock = Number(receipt.blockNumber);
          const fromEvent = extractB20TokenFromReceipt(receipt);
          if (fromEvent) {
            tokenAddr = fromEvent;
          } else if (isInvalidLaunchTokenAddress(tokenAddr)) {
            const retryPredict = await predictB20Address(creator, salt);
            if (retryPredict && !isInvalidLaunchTokenAddress(retryPredict)) {
              tokenAddr = retryPredict;
            }
          }
        } catch (receiptErr) {
          if (isRpcInfrastructureError(receiptErr)) {
            console.warn("[launch] receipt fetch skipped (RPC error)", receiptErr);
          } else {
            const msg =
              receiptErr instanceof Error ? receiptErr.message : "Launch not confirmed on Base";
            throw new Error(msg);
          }
        }

        if (isInvalidLaunchTokenAddress(tokenAddr)) {
          showToast(
            "Token may be live — paste the 0xB20… address from BaseScan to register",
            hash
          );
          return {
            ok: true,
            address: undefined,
            symbol: args.symbol,
            name: args.name,
            imageUrl: args.imageUrl,
            txHash: hash,
          };
        }

        const antiBlocks = args.antiSnipeBlocks ?? 8;
        const saved = await registerLaunchedToken({
          address: tokenAddr,
          name: args.name,
          symbol: args.symbol,
          decimals: args.decimals,
          creator: wallet.address,
          txHash: hash,
          imageUrl: args.imageUrl,
          description: args.description,
          website: args.website,
          twitter: args.twitter,
          telegram: args.telegram,
          discord: args.discord,
          supplyCap: args.supplyCap,
          launchPreset: args.launchPreset,
          vestingSchedule: args.vestingSchedule,
          launchBlock,
          antiSnipeBlocks: antiBlocks,
          poolOpenBlock: launchBlock ?? undefined,
          startPriceUsd: args.startPriceUsd,
          source: "launched",
          tokenType: args.tokenType,
          quoteAsset: args.quoteAsset,
          quoteAssetAddress: args.quoteAssetAddress,
          quoteAssetSymbol: args.quoteAssetSymbol,
          liquidityLocked: args.liquidityLocked,
          lockerAddress: args.lockerAddress,
        });
        if (!saved) {
          showToast(
            "Token is live on Base — app catalog save failed; paste your address to trade",
            hash
          );
        }

        if (
          args.autoSeedLiquidity !== false &&
          args.seedLiquidityEth &&
          args.startPriceUsd
        ) {
          const seed = computeLiquiditySeedAmounts({
            seedEth: args.seedLiquidityEth,
            startPriceUsd: args.startPriceUsd,
            ethUsd: args.ethUsd ?? 2500,
            decimals: args.decimals,
          });
          if (seed) {
            try {
              const seedCalls = buildSeedLiquidityCalls({
                token: tokenAddr,
                creator,
                tokenAmount: seed.tokenWei,
                ethAmount: seed.ethWei,
                dex: args.seedDex ?? "aerodrome",
              });
              await sendAppTransactions(activeConn, wallet.address, seedCalls);
              showToast(
                `💧 Liquidity seeded on ${seedDexLabel(args.seedDex ?? "aerodrome")} — ${args.symbol} is tradable in-app`,
                ""
              );
            } catch (seedErr) {
              const seedMsg =
                seedErr instanceof Error ? seedErr.message.split("\n")[0] : "LP seed failed";
              showToast(
                `Token live — add liquidity manually to enable swaps (${seedMsg}). If approve failed first, retry seed from the token page.`,
                ""
              );
            }
          }
        }

        const nextKeys = bumpWeeklyTxKey(wallet.address, "launch");
        setTxKeys((k) => ({ ...k, ...nextKeys }));
        const { credited, hitCap } = recordConfirmedInAppAction(
          wallet.address,
          "launch",
          nextKeys.launch ?? 0
        );
        setPointsRevision((n) => n + 1);
        if (hitCap && credited === 0) {
          showToast(`${args.symbol} launched — daily point cap reached`, hash);
        } else if (credited > 0) {
          showToast(`🚀 ${args.symbol} launched · +${credited} pts`, hash);
        } else {
          showToast(`🚀 ${args.symbol} launched on Base`, hash);
        }
        return {
          ok: true,
          address: tokenAddr,
          symbol: args.symbol,
          name: args.name,
          imageUrl: args.imageUrl,
          txHash: hash,
        };
      } catch (e) {
        const msg =
          e instanceof Error ? e.message.split("\n")[0] : "Launch failed";
        const friendly =
          isRpcInfrastructureError(e) ||
          /rpc request failed|fetch failed|429|capacity|rate limit/i.test(msg)
            ? "Base RPC is busy — if you approved the tx, check BaseScan in 30s or retry"
            : msg.includes("Number") || msg.includes("underflow") || msg.includes("overflow")
            ? "Invalid supply or mint amount"
            : msg.includes("TokenAlreadyExists")
              ? "Token already exists — change name/symbol and retry"
              : msg.includes("FeatureNotActivated")
                ? "B20 is not activated on Base mainnet yet"
                : msg.includes("not confirmed") || msg.includes("not broadcast")
                  ? "Launch not confirmed — approve the tx in your wallet, keep the tab open, ensure ≥0.0001 ETH on Base, and retry with a new salt"
                  : msg;
        if (!friendly.toLowerCase().includes("reject")) {
          showToast(`❌ ${friendly}`, "");
        }
        return { ok: false };
      } finally {
        setLaunchLoading(false);
      }
    },
    [connType, setConnType, showToast, wallet, siweAuthenticated, siweSignIn, setPointsRevision, setTxKeys]
  );

  const handleTokenSwap = useCallback(
    async (args: {
      token: string;
      symbol: string;
      decimals: number;
      direction: "buy" | "sell";
      amount: string;
      slippageBps: number;
      dex?: LaunchDex;
      referrer?: string | null;
      payAsset?: SwapAsset;
      receiveAsset?: SwapAsset;
      payToken?: string | null;
      receiveToken?: string | null;
      counterDecimals?: number;
    }): Promise<boolean> => {
      if (!wallet) return false;

      const payAsset = args.payAsset ?? "eth";
      const receiveAsset = args.receiveAsset ?? "eth";
      const payDecimals =
        payAsset === "usdc"
          ? USDC_DECIMALS
          : payAsset === "token"
            ? (args.counterDecimals ?? 18)
            : 18;

      setSwapLoading(true);
      try {
        const tokenAddr = args.token as `0x${string}`;
        const tokenDecimals =
          args.direction === "sell" || payAsset === "token"
            ? await fetchErc20Decimals(tokenAddr, args.decimals)
            : args.decimals;

        const quote = await fetchSwapQuote({
          token: args.token,
          direction: args.direction,
          amount: args.amount,
          decimals: tokenDecimals,
          slippageBps: args.slippageBps,
          dex: args.dex ?? "auto",
          referrer: args.referrer ?? null,
          taker: wallet.address,
          payAsset,
          receiveAsset,
          payToken: args.payToken,
          receiveToken: args.receiveToken,
          counterDecimals: args.counterDecimals,
        });

        if (!quote.hasLiquidity) {
          showToast(
            quote.error ||
              quote.antiSnipe?.message ||
              "No swap route found — trade on Aerodrome or add a WETH pool",
            ""
          );
          return false;
        }

        const activeConn = await resolveActiveConnType(connType, wallet.address);
        if (activeConn && activeConn !== connType) {
          setConnType(activeConn);
          persistConnType(activeConn);
        }
        if (!activeConn) {
          showToast("❌ Reconnect wallet to swap", "");
          return false;
        }

        const token = args.token as `0x${string}`;
        const recipient = wallet.address as `0x${string}`;
        const swapDex = quote.dex ?? "uniswap";
        const isAggregator = swapDex === "aggregator";
        const router = (quote.router ??
          (swapDex === "aerodrome" ? AERODROME_ROUTER : SWAP_ROUTER_02)) as `0x${string}`;
        const weth = WETH_BASE as `0x${string}`;
        const minOut = BigInt(quote.amountOutMinimum);
        const uniFee = quote.uniswapFeeTier ?? 3000;
        const uniPath = quote.uniswapPath as `0x${string}` | undefined;
        const aeroStable = quote.aerodromeStable ?? false;
        const aeroHops = quote.aerodromeHops?.map((h) => ({
          from: h.from as `0x${string}`,
          to: h.to as `0x${string}`,
          stable: h.stable,
        }));
        const slipTick = quote.slipstreamTickSpacing ?? 200;
        const creator = quote.creator as `0x${string}` | undefined;
        const referrer = (quote.referrer || args.referrer) as `0x${string}` | null;

        if (isAggregator && (!quote.tx?.to || !quote.tx.data)) {
          showToast("Aggregator route unavailable — try again", "");
          return false;
        }

        if (!(await routerHasCode(router))) {
          showToast("❌ Router unavailable on Base — try another route", "");
          return false;
        }

        const referrerBoostBps = 0;
        const calls = [];
        const payIsNative = payAsset === "eth";
        const isLaunched = Boolean(quote.isLaunchedToken);
        const feeBps = isLaunched ? 50 : 25;
        const grossAmount = parseUnits(
          args.amount,
          args.direction === "buy" ? payDecimals : tokenDecimals
        );
        const { net: netAmount, fee } = splitGrossAmount(grossAmount, feeBps);
        const swapFee = fee;
        const buySwapAmount = isAggregator ? grossAmount : netAmount;
        const swapFeeAsset: "eth" | "usdc" | "token" =
          args.direction === "buy"
            ? (payAsset === "usdc" ? "usdc" : payAsset === "eth" ? "eth" : "token")
            : "token";

        if (grossAmount <= BigInt(0)) {
          showToast("Invalid swap amount", "");
          return false;
        }

        if (args.direction === "buy") {
          const payTokenAddr = (
            payAsset === "usdc"
              ? USDC_BASE
              : payAsset === "token" && args.payToken
                ? args.payToken
                : token
          ) as `0x${string}`;
          const spender = (
            isAggregator ? quote.allowanceSpender ?? quote.tx?.to : router
          ) as `0x${string}` | undefined;

          if (!payIsNative && BASE_RPC && spender) {
            const pub = createBasePublicClient();
            const allowance = await pub.readContract({
              address: payTokenAddr,
              abi: ERC20_ABI,
              functionName: "allowance",
              args: [recipient, spender],
            });
            if (allowance < grossAmount) {
              calls.push(
                buildContractCall(
                  payTokenAddr,
                  encodeB20ApproveCalldata(spender, grossAmount)
                )
              );
            }
          }

          if (isAggregator && quote.tx) {
            calls.push(
              buildExternalSwapCall(
                quote.tx.to as `0x${string}`,
                quote.tx.data as `0x${string}`,
                BigInt(quote.tx.value || "0")
              )
            );
          } else if (!isAggregator) {
            const swapData =
              swapDex === "aerodrome"
                ? (payIsNative
                    ? encodeAerodromeBuy({
                        tokenOut: token,
                        recipient,
                        amountOutMinimum: minOut,
                        stable: aeroStable,
                        hops: aeroHops,
                      })
                    : encodeAerodromeTokensForTokens({
                        tokenIn: payTokenAddr,
                        tokenOut: token,
                        amountIn: buySwapAmount,
                        amountOutMinimum: minOut,
                        recipient,
                        stable: aeroStable,
                        hops: aeroHops,
                      }))
                : swapDex === "slipstream"
                  ? encodeSlipstreamBuy({
                      tokenOut: token,
                      recipient,
                      amountIn: buySwapAmount,
                      amountOutMinimum: minOut,
                      tickSpacing: slipTick,
                    })
                  : uniPath
                    ? encodeExactInputMultiHop({
                        path: uniPath,
                        recipient,
                        amountIn: buySwapAmount,
                        amountOutMinimum: minOut,
                      })
                    : encodeExactInputSingle({
                        tokenIn: (payAsset === "usdc" ? USDC_BASE : payAsset === "token" && args.payToken ? args.payToken : weth) as `0x${string}`,
                        tokenOut: token,
                        recipient,
                        amountIn: buySwapAmount,
                        amountOutMinimum: minOut,
                        fee: uniFee,
                      });
            calls.push(buildContractCall(router, swapData, payIsNative ? buySwapAmount : BigInt(0)));
            if (!isAggregator && swapFee > BigInt(0)) {
              pushFeeSplitCalls(calls, swapFee, {
                native: payIsNative,
                token: payIsNative ? token : payTokenAddr,
                creator: isLaunched ? creator : null,
                referrer,
                referrerBoostBps,
                payer: recipient,
              });
            }
          }
        } else {
          const sellAmount = isAggregator ? grossAmount : netAmount;
          const spender = (
            isAggregator ? quote.allowanceSpender ?? quote.tx?.to : router
          ) as `0x${string}` | undefined;
          if (BASE_RPC && spender) {
            const pub = createBasePublicClient();
            const allowance = await pub.readContract({
              address: token,
              abi: ERC20_ABI,
              functionName: "allowance",
              args: [recipient, spender],
            });
            if (allowance < sellAmount) {
              calls.push(
                buildContractCall(
                  token,
                  encodeB20ApproveCalldata(spender, sellAmount)
                )
              );
            }
          }

          if (isAggregator && quote.tx) {
            calls.push(
              buildExternalSwapCall(
                quote.tx.to as `0x${string}`,
                quote.tx.data as `0x${string}`,
                BigInt(quote.tx.value || "0")
              )
            );
          } else {
            const swapData =
              swapDex === "aerodrome"
                ? (receiveAsset === "eth"
                    ? encodeAerodromeSell({
                        tokenIn: token,
                        recipient,
                        amountIn: sellAmount,
                        amountOutMinimum: minOut,
                        stable: aeroStable,
                        hops: aeroHops,
                      })
                    : encodeAerodromeTokensForTokens({
                        tokenIn: token,
                        tokenOut: (receiveAsset === "usdc" ? USDC_BASE : args.receiveToken || USDC_BASE) as `0x${string}`,
                        amountIn: sellAmount,
                        amountOutMinimum: minOut,
                        recipient,
                        stable: aeroStable,
                        hops: aeroHops,
                      }))
                : swapDex === "slipstream"
                  ? encodeSlipstreamSell({
                      tokenIn: token,
                      recipient,
                      amountIn: sellAmount,
                      amountOutMinimum: minOut,
                      tickSpacing: slipTick,
                    })
                  : uniPath
                    ? (receiveAsset === "eth"
                        ? encodeExactInputMultiHopToEth({
                            path: uniPath,
                            recipient,
                            amountIn: sellAmount,
                            amountOutMinimum: minOut,
                          })
                        : encodeExactInputMultiHop({
                            path: uniPath,
                            recipient,
                            amountIn: sellAmount,
                            amountOutMinimum: minOut,
                          }))
                    : receiveAsset === "eth"
                      ? encodeExactInputSingleToEth({
                          tokenIn: token,
                          recipient,
                          amountIn: sellAmount,
                          amountOutMinimum: minOut,
                          fee: uniFee,
                        })
                      : encodeExactInputSingle({
                          tokenIn: token,
                          tokenOut: (receiveAsset === "usdc" ? USDC_BASE : args.receiveToken || USDC_BASE) as `0x${string}`,
                          recipient,
                          amountIn: sellAmount,
                          amountOutMinimum: minOut,
                          fee: uniFee,
                        });
            calls.push(buildContractCall(router, swapData));
            if (!isAggregator && swapFee > BigInt(0)) {
              pushFeeSplitCalls(calls, swapFee, {
                native: false,
                token,
                creator: isLaunched ? creator : null,
                referrer,
                referrerBoostBps,
                payer: recipient,
              });
            }
          }
        }

        const hash = await sendAppTransactions(activeConn, wallet.address, calls, {
          atomicBatch: true,
        });
        if (setSponsored) setSponsored((s) => s + 1);

        if (isLaunched && creator && swapFee > BigInt(0)) {
          const split = splitPlatformFee(swapFee, {
            creator,
            referrer: referrer ?? null,
            referrerBoostBps,
          });
          const trader = wallet.address.toLowerCase();
          const creatorShare =
            trader === creator.toLowerCase() ? BigInt(0) : split.creator;
          const referrerShare =
            referrer && trader === referrer.toLowerCase()
              ? BigInt(0)
              : split.referrer;
          void fetch("/api/launchpad/fees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              txHash: hash,
              tokenAddress: token,
              tokenSymbol: args.symbol,
              trader: wallet.address,
              creator,
              referrer: referrer ?? null,
              direction: args.direction,
              feeAsset: swapFeeAsset,
              feeAmount: swapFee.toString(),
              creatorShare: creatorShare.toString(),
              platformShare: split.platform.toString(),
              referrerShare: referrerShare.toString(),
            }),
          }).catch(() => {});
        }

        const nextKeys = bumpWeeklyTxKey(wallet.address, "swap");
        setTxKeys((k) => ({ ...k, ...nextKeys }));
        const { credited, hitCap } = recordConfirmedInAppAction(
          wallet.address,
          "swap",
          nextKeys.swap ?? 0
        );
        setPointsRevision((n) => n + 1);
        const label = args.direction === "buy" ? "Buy" : "Sell";
        const via = dexLabel(swapDex);
        if (hitCap && credited === 0) {
          showToast(`${label} ${args.symbol} via ${via} — daily point cap reached`, hash);
        } else if (credited > 0) {
          showToast(`${label} ${args.symbol} via ${via} · +${credited} pts`, hash);
        } else {
          showToast(`✅ ${label} ${args.symbol} via ${via}`, hash);
        }
        return true;
      } catch (e) {
        const msg =
          e instanceof Error ? e.message.split("\n")[0] : "Swap failed";
        if (!msg.toLowerCase().includes("reject")) {
          showToast(`❌ ${msg}`, "");
        }
        return false;
      } finally {
        setSwapLoading(false);
      }
    },
    [connType, setConnType, showToast, wallet, setPointsRevision, setTxKeys, setSponsored]
  );

  const handleSeedLiquidity = useCallback(
    async (args: {
      token: string;
      symbol: string;
      decimals: number;
      tokenAmount: string;
      seedEth: string;
      startPriceUsd?: string;
      seedDex?: SeedDex;
    }): Promise<boolean> => {
      if (!wallet) return false;

      setSwapLoading(true);
      try {
        const activeConn = await resolveActiveConnType(connType, wallet.address);
        if (activeConn && activeConn !== connType) {
          setConnType(activeConn);
          persistConnType(activeConn);
        }
        if (!activeConn) {
          showToast("❌ Reconnect wallet to seed liquidity", "");
          return false;
        }

        const token = args.token as `0x${string}`;
        const creator = wallet.address as `0x${string}`;
        let tokenWei = parseUnits(args.tokenAmount, args.decimals);
        let ethWei = parseEther(args.seedEth);

        if (args.startPriceUsd) {
          const computed = computeLiquiditySeedAmounts({
            seedEth: args.seedEth,
            startPriceUsd: args.startPriceUsd,
            ethUsd: 2500,
            decimals: args.decimals,
          });
          if (computed) {
            tokenWei = computed.tokenWei;
            ethWei = computed.ethWei;
          }
        }

        if (tokenWei <= BigInt(0) || ethWei <= BigInt(0)) {
          showToast("Invalid liquidity amounts", "");
          return false;
        }

        const calls = buildSeedLiquidityCalls({
          token,
          creator,
          tokenAmount: tokenWei,
          ethAmount: ethWei,
          dex: args.seedDex ?? "aerodrome",
        });
        const hash = await sendAppTransactions(activeConn, wallet.address, calls, {
          atomicBatch: true,
        });
        recordInAppTransaction(wallet.address);
        setPointsRevision((n) => n + 1);
        showToast(`💧 ${args.symbol} pool seeded on ${seedDexLabel(args.seedDex ?? "aerodrome")}`, hash);
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message.split("\n")[0] : "Seed failed";
        if (!msg.toLowerCase().includes("reject")) {
          showToast(`❌ ${msg}`, "");
        }
        return false;
      } finally {
        setSwapLoading(false);
      }
    },
    [connType, setConnType, showToast, wallet, setPointsRevision]
  );

  /** Withdraw the wallet's full WETH balance back to native ETH. */
  const handleUnwrapWeth = useCallback(async (): Promise<boolean> => {
    if (!wallet) return false;

    setSwapLoading(true);
    try {
      const activeConn = await resolveActiveConnType(connType, wallet.address);
      if (activeConn && activeConn !== connType) {
        setConnType(activeConn);
        persistConnType(activeConn);
      }
      if (!activeConn) {
        showToast("❌ Reconnect wallet to unwrap", "");
        return false;
      }

      const pub = createBasePublicClient();
      const balance = await pub.readContract({
        address: WETH_BASE,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [wallet.address as `0x${string}`],
      });
      if (balance <= BigInt(0)) {
        showToast("No WETH to unwrap", "");
        return false;
      }

      const call = buildContractCall(WETH_BASE, encodeWethWithdrawCalldata(balance));
      const hash = await sendAppTransactions(activeConn, wallet.address, [call]);
      recordInAppTransaction(wallet.address);
      setPointsRevision((n) => n + 1);
      showToast("Unwrapped WETH to native ETH", hash);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message.split("\n")[0] : "Unwrap failed";
      if (!msg.toLowerCase().includes("reject")) {
        showToast(`❌ ${msg}`, "");
      }
      return false;
    } finally {
      setSwapLoading(false);
    }
  }, [connType, setConnType, showToast, wallet, setPointsRevision]);

  const resetTransactionsState = useCallback(() => {
    setLaunchLoading(false);
    setSwapLoading(false);
  }, []);

  return {
    launchLoading,
    swapLoading,
    b20Activated,
    handleLaunchB20,
    handleTokenSwap,
    handleSeedLiquidity,
    handleUnwrapWeth,
    resetTransactionsState,
  };
}
