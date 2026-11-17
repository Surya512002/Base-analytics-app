/**
 * Detect an image's real type from its bytes. Uploads are served back from our own origin, so
 * the browser-reported `file.type` can't be trusted: an "image/svg+xml" (or HTML posing as an
 * image) would run script as this site. Only these raster formats are accepted and served.
 */
export const SAFE_IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type SafeImageMime = (typeof SAFE_IMAGE_MIMES)[number];

export function sniffImageMime(buf: Uint8Array): SafeImageMime | null {
  const b = (i: number) => buf[i];
  if (buf.length >= 8 && b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47 && b(4) === 0x0d && b(5) === 0x0a && b(6) === 0x1a && b(7) === 0x0a) return "image/png";
  if (buf.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (buf.length >= 12 && b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return "image/webp";
  if (buf.length >= 6 && b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38 && (b(4) === 0x37 || b(4) === 0x39) && b(5) === 0x61) return "image/gif";
  return null;
}

export const isSafeImageMime = (m: string): m is SafeImageMime => (SAFE_IMAGE_MIMES as readonly string[]).includes(m);

/** Headers that keep a served upload inert even if a browser tries to render it as a document. */
export const SAFE_MEDIA_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
  "Cross-Origin-Resource-Policy": "cross-origin",
} as const;
