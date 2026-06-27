/** 1.91:1 — common social / listing thumbnail ratio (e.g. 1200×628). */
export const THUMBNAIL_SIZE = {
  width: 1200,
  height: Math.round(1200 / 1.91),
} as const;
