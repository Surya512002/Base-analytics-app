import { NextResponse } from "next/server";
import { getLaunchpadMedia } from "@/lib/launchpad/media-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const media = await getLaunchpadMedia(id);
  if (!media) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = Buffer.from(media.data, "base64");
  return new NextResponse(body, {
    headers: {
      "Content-Type": media.mime,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
