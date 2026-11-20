import sharp from "sharp";

/** Logos and banners never need more than this; storing the original wastes Redis memory. */
export const MEDIA_MAX_SIDE = 512;

/**
 * Re-encode an uploaded image as a small WebP (max 512px on the long side, first frame of a GIF).
 * A 600 KB upload becomes roughly 20 to 60 KB. Keeps the original if re-encoding doesn't make it smaller.
 */
export async function shrinkImage(buf: Buffer, mime: string): Promise<{ mime: string; buf: Buffer }> {
  try {
    const out = await sharp(buf, { animated: false })
      .rotate()
      .resize(MEDIA_MAX_SIDE, MEDIA_MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return out.length < buf.length ? { mime: "image/webp", buf: out } : { mime, buf };
  } catch {
    return { mime, buf };
  }
}
