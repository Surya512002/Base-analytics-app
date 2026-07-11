/** Normalize Neynar bulk-by-address responses (shape varies by endpoint version). */
export function parseNeynarUsersByAddress(
  data: Record<string, unknown>,
  address: string
): Record<string, unknown>[] {
  const lower = address.toLowerCase();

  const keyed = data[lower];
  if (Array.isArray(keyed) && keyed.length > 0) {
    return keyed as Record<string, unknown>[];
  }
  if (keyed && typeof keyed === "object" && !Array.isArray(keyed)) {
    return [keyed as Record<string, unknown>];
  }

  const users = data.users;
  if (Array.isArray(users)) {
    const matched = users.filter((u) => {
      if (!u || typeof u !== "object") return false;
      const row = u as Record<string, unknown>;
      const verifications = row.verifications as string[] | undefined;
      const custody = row.custody_address as string | undefined;
      const verified = row.verified_addresses as
        | { eth_addresses?: string[] }
        | undefined;
      const ethAddrs = verified?.eth_addresses ?? [];
      if (verifications?.some((v) => v.toLowerCase() === lower)) return true;
      if (custody?.toLowerCase() === lower) return true;
      if (ethAddrs.some((a) => a.toLowerCase() === lower)) return true;
      return false;
    });
    if (matched.length > 0) return matched as Record<string, unknown>[];
    if (users.length === 1) return [users[0] as Record<string, unknown>];
  }

  return [];
}

export function neynarUserLabel(user: Record<string, unknown>): string | null {
  const display =
    typeof user.display_name === "string" ? user.display_name.trim() : "";
  if (display) return display;
  const username =
    typeof user.username === "string" ? user.username.trim().replace(/^@/, "") : "";
  if (username) return `@${username}`;
  return null;
}
