import { NextResponse } from "next/server";
import { getLaunchpadMedia } from "@/lib/launchpad/media-store";
import { isSafeImageMime, SAFE_MEDIA_HEADERS, sniffImageMime } from "@/lib/launchpad/image-sniff";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const media = await getLaunchpadMedia(id);
  if (!media) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = Buffer.from(media.data, "base64");
  // Serve only real raster images (checked from the bytes), never what an old upload claimed,
  // so a stored SVG/HTML file can't run script on this origin.
  const mime = sniffImageMime(body);
  if (!mime || !isSafeImageMime(mime)) {
    return new NextResponse("Unsupported media", { status: 415, headers: SAFE_MEDIA_HEADERS });
  }
  return new NextResponse(body, {
    headers: {
      ...SAFE_MEDIA_HEADERS,
      "Content-Type": mime,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
