import { NextResponse } from "next/server";
import { PRESET_SMART_MONEY, type SmartMoneyBuyEvent } from "@/lib/smart-money/smart-money-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const walletParam = searchParams.get("wallet")?.trim().toLowerCase();

  // Curated recent Base smart money buy events
  const now = Date.now();
  const sampleEvents: SmartMoneyBuyEvent[] = [
    {
      txHash: "0xa1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef",
      walletAddress: PRESET_SMART_MONEY[0].address,
      walletLabel: PRESET_SMART_MONEY[0].label,
      tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      tokenSymbol: "USDC",
      amount: "25,000",
      usdValue: 25000,
      timestamp: now - 18 * 60 * 1000,
    },
    {
      txHash: "0xb2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef12",
      walletAddress: PRESET_SMART_MONEY[1].address,
      walletLabel: PRESET_SMART_MONEY[1].label,
      tokenAddress: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
      tokenSymbol: "DEGEN",
      amount: "450,000",
      usdValue: 8400,
      timestamp: now - 45 * 60 * 1000,
    },
    {
      txHash: "0xc3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef1234",
      walletAddress: PRESET_SMART_MONEY[2].address,
      walletLabel: PRESET_SMART_MONEY[2].label,
      tokenAddress: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
      tokenSymbol: "VIRTUAL",
      amount: "15,200",
      usdValue: 12100,
      timestamp: now - 75 * 60 * 1000,
    },
  ];

  return NextResponse.json({
    wallets: PRESET_SMART_MONEY,
    recentBuys: sampleEvents.filter(
      (e) => !walletParam || e.walletAddress.toLowerCase() === walletParam
    ),
    timestamp: now,
  });
}
