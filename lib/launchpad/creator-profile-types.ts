export interface CreatorProfile {
  address: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  createdAt: number;
  updatedAt: number;
}

export function isCreatorProfileComplete(profile: CreatorProfile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    profile.displayName?.trim() ||
      profile.bio?.trim() ||
      profile.avatarUrl?.trim() ||
      profile.website?.trim() ||
      profile.twitter?.trim()
  );
}

export function creatorDisplayName(
  profile: CreatorProfile | null | undefined,
  address: string
): string {
  if (profile?.displayName?.trim()) return profile.displayName.trim();
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
