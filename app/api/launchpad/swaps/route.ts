import { NextResponse } from "next/server";
import { decodeEventLog, type Address, type Hex } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { WETH_BASE } from "@/lib/launchpad/uniswap";
import { ensurePoolOpenBlock } from "@/lib/launchpad/token-protection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAddressLike(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

type DexScreenerPair = {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  liquidity?: { usd?: number };
};

type DexScreenerResp = { pairs?: DexScreenerPair[] };

const UNISWAP_V3_POOL_ABI = [
  {
    name: "token0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address", name: "" }],
  },
  {
    name: "token1",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address", name: "" }],
  },
  {
    type: "event",
    name: "Swap",
    inputs: [
      { indexed: true, name: "sender", type: "address" },
      { indexed: true, name: "recipient", type: "address" },
      { indexed: false, name: "amount0", type: "int256" },
      { indexed: false, name: "amount1", type: "int256" },
      { indexed: false, name: "sqrtPriceX96", type: "uint160" },
      { indexed: false, name: "liquidity", type: "uint128" },
      { indexed: false, name: "tick", type: "int24" },
    ],
  },
] as const;

const VELODROME_V2_PAIR_ABI = [
  {
    name: "token0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address", name: "" }],
  },
  {
    name: "token1",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address", name: "" }],
  },
  {
    type: "event",
    name: "Swap",
    inputs: [
      { indexed: true, name: "sender", type: "address" },
      { indexed: false, name: "amount0In", type: "uint256" },
      { indexed: false, name: "amount1In", type: "uint256" },
      { indexed: false, name: "amount0Out", type: "uint256" },
      { indexed: false, name: "amount1Out", type: "uint256" },
      { indexed: true, name: "to", type: "address" },
    ],
  },
] as const;

function pickBestPair(pairs: DexScreenerPair[]) {
  const basePairs = pairs
    .filter((p) => (p.chainId ?? "").toLowerCase() === "base")
    .filter((p) => Boolean(p.pairAddress && isAddressLike(p.pairAddress)));
  if (!basePairs.length) return null;
  return (
    [...basePairs].sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
    )[0] ?? null
  );
}

function absBigInt(x: bigint): bigint {
  return x < BigInt(0) ? -x : x;
}

async function fetchEthUsd(): Promise<number> {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { next: { revalidate: 60 } }
    );
    if (!r.ok) return 2500;
    const data = (await r.json()) as { ethereum?: { usd?: number } };
    return data.ethereum?.usd ?? 2500;
  } catch {
    return 2500;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "").trim();
  const limit = Math.max(
    1,
    Math.min(50, parseInt(searchParams.get("limit") || "25", 10) || 25)
  );

  if (!isAddressLike(token)) {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }

  try {
    const ds = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${token}`,
      { cache: "no-store" }
    );
    const dsData = (await ds.json()) as DexScreenerResp;
    const best = pickBestPair(dsData.pairs ?? []);
    if (!best?.pairAddress) {
      return NextResponse.json({ swaps: [], error: "No pool found yet" });
    }

    const pool = best.pairAddress as Address;
    const dexId = (best.dexId || "").toLowerCase();
    const pub = createBasePublicClient();

    const isV3 = dexId.includes("uniswap");
    const abi = isV3 ? UNISWAP_V3_POOL_ABI : VELODROME_V2_PAIR_ABI;

    const [token0, token1, head] = await Promise.all([
      pub.readContract({ address: pool, abi, functionName: "token0" }),
      pub.readContract({ address: pool, abi, functionName: "token1" }),
      pub.getBlockNumber(),
    ]);

    // Look back a limited range to keep it fast and reliable.
    const fromBlock = head > BigInt(6000) ? (head - BigInt(6000)) : BigInt(0);

    const swapEvent = abi.find((x) => x.type === "event" && x.name === "Swap");
    if (!swapEvent) {
      return NextResponse.json({ swaps: [] });
    }

    const logs = await pub.getLogs({
      address: pool,
      event: swapEvent,
      fromBlock,
      toBlock: "latest",
    });

    const recent = [...logs].slice(-Math.max(limit, 40)).reverse().slice(0, limit);
    const blockNums = Array.from(
      new Set(recent.map((l) => l.blockNumber).filter(Boolean))
    ) as bigint[];

    const blocks = await Promise.all(
      blockNums.map(async (bn) => {
        const b = await pub.getBlock({ blockNumber: bn });
        return [bn.toString(), Number(b.timestamp)] as const;
      })
    );
    const tsByBlock = new Map(blocks);

    const weth = WETH_BASE.toLowerCase();
    const tokenLower = token.toLowerCase();
    const t0 = (token0 as string).toLowerCase();
    const t1 = (token1 as string).toLowerCase();

    const ethUsd = await fetchEthUsd();

    const rows = recent.map((log) => {
      const decoded = decodeEventLog({
        abi,
        data: log.data as Hex,
        // viem types topics as a tuple for known events; logs give us a generic array.
        topics: log.topics as [] | [signature: Hex, ...args: Hex[]],
      });
      const args = decoded.args as Record<string, unknown>;

      let amountToken = BigInt(0);
      let amountEth = BigInt(0);
      let side: "buy" | "sell" = "buy";
      let trader = "";

      if (isV3) {
        const a0 = args.amount0 as bigint;
        const a1 = args.amount1 as bigint;
        trader = (args.recipient as string) || (args.sender as string);

        // Determine which leg is token vs WETH, then infer direction from signs.
        const tokenIs0 = t0 === tokenLower;
        const wethIs0 = t0 === weth;
        const tokenIs1 = t1 === tokenLower;
        const wethIs1 = t1 === weth;

        if ((tokenIs0 && wethIs1) || (wethIs0 && tokenIs1)) {
          const tokenDelta = tokenIs0 ? a0 : a1;
          const wethDelta = tokenIs0 ? a1 : a0;

          // If pool loses token (negative delta) user bought token with WETH.
          side = tokenDelta < BigInt(0) ? "buy" : "sell";
          amountToken = absBigInt(tokenDelta);
          amountEth = absBigInt(wethDelta);
        }
      } else {
        trader = (args.to as string) || (args.sender as string);

        const a0In = args.amount0In as bigint;
        const a1In = args.amount1In as bigint;
        const a0Out = args.amount0Out as bigint;
        const a1Out = args.amount1Out as bigint;

        const tokenIs0 = t0 === tokenLower;
        const wethIs0 = t0 === weth;
        const tokenIs1 = t1 === tokenLower;
        const wethIs1 = t1 === weth;

        if ((tokenIs0 && wethIs1) || (wethIs0 && tokenIs1)) {
          const tokenIn = tokenIs0 ? a0In : a1In;
          const tokenOut = tokenIs0 ? a0Out : a1Out;
          const wethIn = tokenIs0 ? a1In : a0In;
          const wethOut = tokenIs0 ? a1Out : a0Out;

          // buy: user pays WETH in, receives token out
          if (wethIn > BigInt(0) && tokenOut > BigInt(0)) {
            side = "buy";
            amountToken = tokenOut;
            amountEth = wethIn;
          } else if (tokenIn > BigInt(0) && wethOut > BigInt(0)) {
            side = "sell";
            amountToken = tokenIn;
            amountEth = wethOut;
          }
        }
      }

      const tokenAmt = Number(amountToken) / 1e18;
      const ethAmt = Number(amountEth) / 1e18;
      const priceEth = tokenAmt > 0 ? ethAmt / tokenAmt : 0;
      const priceUsd = priceEth * ethUsd;
      const valueUsd = ethAmt * ethUsd;

      return {
        txHash: log.transactionHash,
        blockNumber: log.blockNumber?.toString(),
        timestamp: tsByBlock.get(log.blockNumber?.toString() || "") || null,
        side,
        trader,
        amountToken: amountToken.toString(),
        amountEth: amountEth.toString(),
        priceEth,
        priceUsd,
        valueUsd,
        ethUsd,
        dexId: best.dexId || "",
        pool,
      };
    });

    if (rows.length > 0) {
      const minBlock = rows.reduce((min, r) => {
        const bn = r.blockNumber ? Number(r.blockNumber) : Number(head);
        return Math.min(min, bn);
      }, Number(head));
      await ensurePoolOpenBlock(token, minBlock).catch(() => {});
    }

    return NextResponse.json({ swaps: rows, pool, dexId: best.dexId || "", ethUsd });
  } catch (e) {
    console.error("[launchpad/swaps]", e);
    return NextResponse.json({ swaps: [], error: "Failed to load swaps" });
  }
}

