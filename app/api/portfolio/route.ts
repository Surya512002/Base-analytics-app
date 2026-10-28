import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { getClientIp, checkRateLimit } from "@/lib/api/rate-limit";
import { getWalletPortfolio } from "@/lib/portfolio/portfolio-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`portfolio:${ip}`, 60, 60_000); // 60 requests per minute
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const rawAddress = searchParams.get("address")?.trim();

  if (!rawAddress || !rawAddress.startsWith("0x") || rawAddress.length !== 42) {
    return NextResponse.json(
      { error: "Invalid Ethereum address format for Base mainnet" },
      { status: 400 }
    );
  }

  let address: `0x${string}`;
  try {
    address = getAddress(rawAddress);
  } catch {
    return NextResponse.json(
      { error: "Invalid EIP-55 address checksum" },
      { status: 400 }
    );
  }

  // Parse custom tokens if passed (comma-separated 0x addresses)
  const customParam = searchParams.get("customTokens")?.trim();
  const customTokenAddresses = customParam
    ? customParam.split(",").map((s) => s.trim()).filter((s) => s.startsWith("0x"))
    : [];

  const includeDefi = searchParams.get("defi") !== "false";

  try {
    const portfolio = await getWalletPortfolio(address, customTokenAddresses, includeDefi);
    return NextResponse.json(portfolio, {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("[portfolio-api] Failed to build portfolio:", error);
    return NextResponse.json(
      { error: "Failed to scan wallet portfolio on Base mainnet" },
      { status: 500 }
    );
  }
}
