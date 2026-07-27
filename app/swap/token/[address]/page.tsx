import type { Metadata } from "next";
import HomeApp from "@/components/home/HomeApp";

export const metadata: Metadata = {
  title: "Swap · Base Analytics",
  description: "Trade any token on Base — DEX routing via Aerodrome, Uniswap, Slipstream, and 0x.",
};

export default async function SwapTokenPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const token = address?.trim().toLowerCase();
  const valid = token?.startsWith("0x") && token.length === 42 ? token : null;
  return <HomeApp forceTab="swap" initialToken={valid} />;
}
