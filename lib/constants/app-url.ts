import { OG_VERSION } from "@/lib/og/brand-kit";
import { OG_SECTIONS, type OgSection } from "@/lib/og/sections";

/** Canonical public app URL for OG, share links, and metadata. */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "https://baseanalytics.app"
  );
}

/** The home sharing image, or a section's own. */
export function appOgImage(section?: OgSection): string {
  return section
    ? `${getAppUrl()}/api/og?v=${section}&ogv=${OG_VERSION}`
    : `${getAppUrl()}/opengraph-image?ogv=${OG_VERSION}`;
}

/** The image part of a page's metadata, for link previews and for X. */
export function sectionShare(section: OgSection) {
  const url = appOgImage(section);
  return {
    images: [{ url, width: 1200, height: 630, alt: OG_SECTIONS[section][0] }],
    twitter: { card: "summary_large_image" as const, images: [url] },
  };
}
