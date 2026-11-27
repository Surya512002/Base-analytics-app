import type { Metadata } from "next";
import { getAppUrl, sectionShare } from "@/lib/constants/app-url";
import HomeApp from "@/components/home/HomeApp";

const appUrl = getAppUrl();

export const metadata: Metadata = {
  title: "Lend, Borrow & Stake on Base Network — Tokenized Stocks, Morpho & Aerodrome",
  description:
    "Borrow USDC against Coinbase B20 tokenized stocks (NVDAc, AAPLc, TSLAc) on Base mainnet. Lend and stake across Aave V4, Morpho Blue, Beefy and Aerodrome with Base Builder attribution.",
  twitter: sectionShare("earn").twitter,
  openGraph: {
    title: "Lend, Borrow & Stake Stocks on Base · Base Analytics",
    description:
      "Deposit tokenized equities as collateral, borrow cash, and stake in Aerodrome gauges with verified Base Builder Code attribution.",
    url: `${appUrl}/lend`,
    images: sectionShare("earn").images,
  },
  alternates: { canonical: `${appUrl}/lend` },
};

export default function LendPage() {
  return (
    <>
      <div className="sr-only" aria-hidden={false}>
        <h1>Lend, Borrow and Stake Tokenized Stocks on Base Network</h1>
        <p>
          Base mainnet lending and borrowing through Aave V4, Morpho Blue, Beefy and Aerodrome Finance.
          Borrow cash against tokenized stocks without selling your equity.
        </p>
      </div>
      <HomeApp forceTab="lend" />
    </>
  );
}
