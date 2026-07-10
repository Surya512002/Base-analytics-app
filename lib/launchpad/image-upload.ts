const MAX_EDGE = 512;
const MAX_BYTES = 500_000;
const WEBP_QUALITY = 0.82;

export interface PreparedTokenImage {
  blob: Blob;
  previewUrl: string;
  mime: string;
}

/** Resize + compress an image file for token avatar upload. */
export async function prepareTokenImage(file: File): Promise<PreparedTokenImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (PNG, JPG, WebP)");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image must be under 8MB");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Image compression failed"))),
      "image/webp",
      WEBP_QUALITY
    );
  });

  if (blob.size > MAX_BYTES) {
    throw new Error("Image too large after compression — try a smaller file");
  }

  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    mime: "image/webp",
  };
}

export function revokePreviewUrl(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}
