import { NextResponse } from "next/server";
import {
  addBadgeListing,
  listBadgeListings,
  removeBadgeListing,
} from "@/lib/badge-market/listings-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const listings = await listBadgeListings();
  return NextResponse.json({ listings });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      seller?: string;
      tokenId?: number;
      catId?: string;
      catName?: string;
      tierName?: string;
      tierIcon?: string;
      priceUsdc?: string;
    };
    if (
      !body.seller?.startsWith("0x") ||
      !body.tokenId ||
      !body.priceUsdc ||
      !body.catName
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const listing = await addBadgeListing({
      seller: body.seller,
      tokenId: body.tokenId,
      catId: body.catId ?? "",
      catName: body.catName,
      tierName: body.tierName ?? "",
      tierIcon: body.tierIcon ?? "🏆",
      priceUsdc: body.priceUsdc,
    });
    return NextResponse.json({ listing });
  } catch (err) {
    console.error("[badge-market POST]", err);
    return NextResponse.json({ error: "Failed to list" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const seller = searchParams.get("seller");
  if (!id || !seller) {
    return NextResponse.json({ error: "id and seller required" }, { status: 400 });
  }
  const ok = await removeBadgeListing(id, seller);
  return NextResponse.json({ ok });
}
