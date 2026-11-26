import { OG_VERSION } from "@/lib/og/brand-kit";

/** Canonical public app URL for OG, share links, and metadata. */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "https://baseanalytics.app"
  );
}

export function appOgImage(bust = OG_VERSION): string {
  return `${getAppUrl()}/opengraph-image?ogv=${bust}`;
}
