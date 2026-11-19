import { NextResponse } from "next/server";
import { taskCatalog } from "@/lib/drops/tasks";
import { ticketSigner } from "@/lib/drops/chain";

export const dynamic = "force-dynamic";

/** GET /api/drops/catalog → task types creators can add, and the app's ticket signer address. */
export async function GET() {
  return NextResponse.json({ tasks: taskCatalog(), ticketSigner: ticketSigner()?.address ?? null });
}
