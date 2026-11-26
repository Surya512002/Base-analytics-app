import type { Metadata } from "next";
import { getAppUrl, sectionShare } from "@/lib/constants/app-url";
import HomeApp from "@/components/home/HomeApp";

const appUrl = getAppUrl();

export const metadata: Metadata = {
  title: "Drops — gifts with rules, daily claims and verified tasks on Base",
  description:
    "Give ETH, USDC or any token on Base with your own rules: one link or unique codes, token holders or a list, daily claims, and verified tasks like follows, buys, posts and quizzes.",
  twitter: sectionShare("drops").twitter,
  openGraph: {
    title: "Drops · Base Analytics",
    description: "Rule-based gifts on Base: links, codes, allowlists, daily claims and verified tasks.",
    url: `${appUrl}/drops`,
    images: sectionShare("drops").images,
  },
  alternates: { canonical: `${appUrl}/drops` },
};

export default function DropsPage() {
  return <HomeApp forceTab="drops" />;
}
