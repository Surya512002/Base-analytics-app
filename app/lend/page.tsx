import type { Metadata } from "next";
import { getAppUrl, appOgImage } from "@/lib/constants/app-url";
import HomeApp from "@/components/home/HomeApp";

const appUrl = getAppUrl();

export const metadata: Metadata = {
  title: "Lend, Borrow & Stake on Base Network — Tokenized Stocks, Morpho & Aerodrome",
  description:
    "Borrow USDC against Coinbase B20 tokenized stocks (NVDAc, AAPLc, TSLAc, COINc) on Base mainnet. Earn high APY lending and staking across IPOR Fusion, Morpho Blue, Aerodrome gauges, and Aave v3 with Base Builder attribution.",
  openGraph: {
    title: "Lend, Borrow & Stake Stocks on Base · Base Analytics",
    description:
      "Deposit tokenized equities as collateral, borrow cash, and stake in Aerodrome gauges with verified Base Builder Code attribution.",
    url: `${appUrl}/lend`,
    images: [{ url: appOgImage(), width: 1200, height: 630 }],
  },
  alternates: { canonical: `${appUrl}/lend` },
};

export default function LendPage() {
  return (
    <>
      <div className="sr-only" aria-hidden={false}>
        <h1>Lend, Borrow and Stake Tokenized Stocks on Base Network</h1>
        <p>
          Official Base mainnet lending and borrowing powered by IPOR Fusion, Morpho Blue, Aerodrome Finance,
          and Aave v3. Borrow cash against tokenized stocks without selling your equity.
        </p>
      </div>
      <HomeApp forceTab="lend" />
    </>
  );
}
