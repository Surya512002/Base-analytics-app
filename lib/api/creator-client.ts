import type { CreatorProfile } from "@/lib/launchpad/creator-profile-types";
import { uploadLaunchpadImage } from "@/lib/api/launchpad-client";

export async function fetchCreatorProfile(address: string): Promise<CreatorProfile | null> {
  const addr = address.trim().toLowerCase();
  if (!addr.startsWith("0x") || addr.length !== 42) return null;
  try {
    const r = await fetch(`/api/creator/${addr}/profile`, { cache: "no-store" });
    if (!r.ok) return null;
    const data = (await r.json()) as { profile?: CreatorProfile };
    return data.profile ?? null;
  } catch {
    return null;
  }
}

export async function fetchCreatorProfiles(
  addresses: string[]
): Promise<Record<string, CreatorProfile>> {
  const unique = [...new Set(addresses.map((a) => a.trim().toLowerCase()))].filter(
    (a) => a.startsWith("0x") && a.length === 42
  );
  if (unique.length === 0) return {};
  try {
    const r = await fetch(
      `/api/creator/profiles?addresses=${encodeURIComponent(unique.join(","))}`,
      { cache: "no-store" }
    );
    if (!r.ok) return {};
    const data = (await r.json()) as { profiles?: Record<string, CreatorProfile> };
    return data.profiles ?? {};
  } catch {
    return {};
  }
}

export async function updateCreatorProfile(
  address: string,
  patch: Partial<
    Pick<CreatorProfile, "displayName" | "bio" | "avatarUrl" | "website" | "twitter" | "telegram">
  >
): Promise<{ ok: boolean; profile?: CreatorProfile; error?: string }> {
  const addr = address.trim().toLowerCase();
  try {
    const r = await fetch(`/api/creator/${addr}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error ?? "Save failed" };
    }
    const data = (await r.json()) as { profile: CreatorProfile };
    return { ok: true, profile: data.profile };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function uploadCreatorAvatar(blob: Blob): Promise<string | null> {
  const file = new File([blob], "avatar.webp", { type: blob.type || "image/webp" });
  return uploadLaunchpadImage(file);
}
