"use client";

const IDENTITY_KEY_PREFIX = "base_miniapp_identity_v1_";

export type MiniAppIdentity = {
  displayName: string | null;
  username: string | null;
  fid: number | null;
};

function storageKey(address: string): string {
  return `${IDENTITY_KEY_PREFIX}${address.toLowerCase()}`;
}

export function readPersistedMiniAppIdentity(
  address: string
): MiniAppIdentity | null {
  if (typeof window === "undefined" || !address) return null;
  try {
    const raw = localStorage.getItem(storageKey(address));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MiniAppIdentity;
    if (!parsed.displayName && !parsed.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persistMiniAppIdentity(
  address: string,
  identity: MiniAppIdentity
): void {
  if (typeof window === "undefined" || !address) return;
  if (!identity.displayName && !identity.username) return;
  try {
    localStorage.setItem(storageKey(address), JSON.stringify(identity));
  } catch {
    /* quota */
  }
}

/** Best label for UI — Basename beats Base App display name beats @username. */
export function formatWalletDisplayLabel(
  address: string,
  opts?: {
    basename?: string | null;
    miniApp?: MiniAppIdentity | null;
  }
): string {
  if (opts?.basename?.trim()) return opts.basename.trim();
  const mini = opts?.miniApp;
  if (mini?.displayName?.trim()) return mini.displayName.trim();
  if (mini?.username?.trim()) return `@${mini.username.replace(/^@/, "")}`;
  return `${address.slice(0, 8)}…${address.slice(-4)}`;
}

/** Read Base App / Warpcast user from mini-app SDK context (email/passkey wallets included). */
export async function resolveMiniAppIdentity(): Promise<MiniAppIdentity | null> {
  if (typeof window === "undefined") return null;
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const ctx = await Promise.race([
      sdk.context,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
    ]);
    const user = (ctx as { user?: Record<string, unknown> } | null)?.user;
    if (!user) return null;

    const displayName =
      typeof user.displayName === "string" && user.displayName.trim()
        ? user.displayName.trim()
        : null;
    const username =
      typeof user.username === "string" && user.username.trim()
        ? user.username.trim().replace(/^@/, "")
        : null;
    const fid = typeof user.fid === "number" ? user.fid : null;

    if (!displayName && !username) return null;
    return { displayName, username, fid };
  } catch {
    return null;
  }
}

export async function resolveMiniAppIdentityForAddress(
  address: string
): Promise<MiniAppIdentity | null> {
  const cached = readPersistedMiniAppIdentity(address);
  if (cached) return cached;

  const live = await resolveMiniAppIdentity();
  if (live) persistMiniAppIdentity(address, live);
  return live;
}
