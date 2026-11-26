import type { Metadata } from "next";
import { sectionShare } from "@/lib/constants/app-url";
import HomeApp from "@/components/home/HomeApp";

export const metadata: Metadata = {
  openGraph: { images: sectionShare("launch").images },
  twitter: sectionShare("launch").twitter,
  title: "Launch Tokens & Memestocks | Base Analytics",
  description:
    "Launch B20 vanity tokens, standard ERC-20 meme coins, and Stonks Exchange style stock-paired memestocks on Base with instant 0.25% creator revenue sharing.",
};

export default function LaunchPage() {
  return <HomeApp forceTab="launchpad" initialLaunchView="create" />;
}
