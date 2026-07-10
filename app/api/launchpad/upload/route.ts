import { NextResponse } from "next/server";
import {
  mediaPayloadTooLarge,
  storeLaunchpadMedia,
} from "@/lib/launchpad/media-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
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

    const mime = file.type || "image/webp";
    const id = await storeLaunchpadMedia(mime, buf.toString("base64"));
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
