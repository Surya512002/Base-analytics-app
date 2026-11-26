import type { Metadata } from "next";
import HomeApp from "@/components/home/HomeApp";
import { sectionShare } from "@/lib/constants/app-url";

export const metadata: Metadata = {
  title: "Swap on Base | Base Analytics",
  openGraph: { title: "Swap · Base Analytics", images: sectionShare("swap").images },
  twitter: sectionShare("swap").twitter,
};

export default function SwapPage() {
  return <HomeApp forceTab="swap" />;
}
