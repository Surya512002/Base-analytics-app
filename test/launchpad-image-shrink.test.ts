import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { MEDIA_MAX_SIDE, shrinkImage } from "@/lib/launchpad/image-shrink";

describe("launchpad image shrink", () => {
  it("turns a big noisy PNG into a small WebP no wider than 512px", async () => {
    const raw = Buffer.alloc(1200 * 1200 * 3);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
    const png = await sharp(raw, { raw: { width: 1200, height: 1200, channels: 3 } }).png({ compressionLevel: 1 }).toBuffer();
    const out = await shrinkImage(png, "image/png");
    expect(out.mime).toBe("image/webp");
    expect(out.buf.length).toBeLessThan(png.length / 3);
    const meta = await sharp(out.buf).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(MEDIA_MAX_SIDE);
  });

  it("keeps small images as they are and never grows a file", async () => {
    const tiny = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#0052ff" } }).webp({ quality: 100, lossless: true }).toBuffer();
    const out = await shrinkImage(tiny, "image/webp");
    expect(out.buf.length).toBeLessThanOrEqual(tiny.length);
  });

  it("returns the original when the bytes aren't a decodable image", async () => {
    const junk = Buffer.from("not an image at all");
    expect(await shrinkImage(junk, "image/png")).toEqual({ mime: "image/png", buf: junk });
  });
});
