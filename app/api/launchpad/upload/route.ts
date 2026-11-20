import { NextResponse } from "next/server";
import {
  mediaPayloadTooLarge,
  storeLaunchpadMedia,
} from "@/lib/launchpad/media-store";
import { sniffImageMime } from "@/lib/launchpad/image-sniff";
import { shrinkImage } from "@/lib/launchpad/image-shrink";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Uploads are stored in Redis: cap them per IP so nobody can fill the store.
  const rl = await checkRateLimitAsync(`launchpad-upload:${getClientIp(req)}`, 10, 10 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file" }, { status: 400 });
    }
    if (file.size > 600_000) {
      return NextResponse.json(
        { error: "Image must be under 600KB after compression" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (mediaPayloadTooLarge(buf.length)) {
      return NextResponse.json({ error: "Image too large" }, { status: 400 });
    }
    // Trust the bytes, not the browser's file.type: only PNG, JPEG, WebP and GIF are stored
    // (no SVG / HTML, which could run script when served from this origin).
    const mime = sniffImageMime(buf);
    if (!mime) {
      return NextResponse.json({ error: "Use a PNG, JPEG, WebP or GIF image" }, { status: 400 });
    }

    // Stored in Redis, so keep it small: a logo is about 20-60 KB as WebP instead of up to 800 KB.
    const small = await shrinkImage(buf, mime);
    const id = await storeLaunchpadMedia(small.mime, small.buf.toString("base64"));
    const origin = new URL(req.url).origin;

    return NextResponse.json({
      id,
      url: `${origin}/api/launchpad/media/${id}`,
    });
  } catch (err) {
    console.error("[launchpad/upload]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
