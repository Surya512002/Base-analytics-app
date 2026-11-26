import type { Metadata } from "next";
import { getAppUrl, sectionShare } from "@/lib/constants/app-url";
import HomeApp from "@/components/home/HomeApp";

const appUrl = getAppUrl();

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const safe = /^\d{10,20}$/.test(id) ? id : "";
  return {
    title: safe ? `Drop #${safe} · Base Analytics` : "Drop · Base Analytics",
    description: "Claim a gift on Base. The claim link's key stays in your browser.",
    twitter: sectionShare("drops").twitter,
    openGraph: {
      title: safe ? `You've got a drop (#${safe})` : "You've got a drop",
      description: "Open to see what's inside and claim it on Base.",
      url: safe ? `${appUrl}/drops/${safe}` : `${appUrl}/drops`,
      images: sectionShare("drops").images,
    },
    // Claim pages are personal; keep them out of search results.
    robots: { index: false, follow: false },
  };
}

/** /drops/:id#k=… — the claim page (the key in the fragment never reaches the server). */
export default function DropClaimPage() {
  return <HomeApp forceTab="drops" />;
}
