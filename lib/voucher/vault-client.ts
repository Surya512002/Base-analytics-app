/**
 * Browser side of the private vault: keeps the vault key on this device, merges this device's
 * saved secrets with the encrypted copy on the server, and restores them on a new device.
 *
 * Secrets synced:
 *  - gift-card claim secrets (local batch store, `base_voucher_batches_<addr>`)
 *  - one-link gift keys (campaign panel store, `base_campaign_links_v1_<addr>`)
 */
import { loadLocalBatches, saveLocalBatch, type StoredVoucherBatch } from "@/lib/utils/voucher";
import {
  createVault,
  mergeVaultContents,
  openContents,
  rotatePhrase,
  sameVaultSecrets,
  sealContents,
  unlockWithPhrase,
  type VaultCampaignLink,
  type VaultContents,
  type VaultEnvelope,
} from "@/lib/voucher/vault-crypto";

export interface RemoteVault {
  envelope: VaultEnvelope;
  version: number;
  updatedAt: number;
}

const keySlot = (addr: string) => `base_voucher_vault_key_v1_${addr.toLowerCase()}`;
const campaignSlot = (addr: string) => `base_campaign_links_v1_${addr.toLowerCase()}`;

// ───────────────────────────── local key ─────────────────────────────

export function getLocalVaultKey(addr: string): string | null {
  try {
    return localStorage.getItem(keySlot(addr));
  } catch {
    return null;
  }
}

function setLocalVaultKey(addr: string, key: string | null): void {
  try {
    if (key) localStorage.setItem(keySlot(addr), key);
    else localStorage.removeItem(keySlot(addr));
  } catch {
    /* private mode: the creator will need the phrase again next visit */
  }
}

export function hasLocalVaultKey(addr: string): boolean {
  return Boolean(addr && getLocalVaultKey(addr));
}

/** Forget the vault key on this device (the phrase still unlocks it). */
export function lockVaultOnThisDevice(addr: string): void {
  setLocalVaultKey(addr, null);
}

// ───────────────────────────── local secrets ─────────────────────────────

function readLocalCampaigns(addr: string): VaultCampaignLink[] {
  try {
    const raw = localStorage.getItem(campaignSlot(addr));
    const parsed = raw ? (JSON.parse(raw) as VaultCampaignLink[]) : [];
    return Array.isArray(parsed) ? parsed.filter((c) => c?.id && c.secret) : [];
  } catch {
    return [];
  }
}

function writeLocalCampaigns(addr: string, links: VaultCampaignLink[]): void {
  try {
    localStorage.setItem(campaignSlot(addr), JSON.stringify(links.slice(0, 200)));
  } catch {
    /* quota / private mode */
  }
}

/** Every secret this device holds for `addr`. */
export function collectLocalSecrets(addr: string): VaultContents {
  const cards = loadLocalBatches(addr).filter((b) => b.cards?.some((c) => c.secret?.trim()));
  return { cards, campaigns: readLocalCampaigns(addr) };
}

/** Write vault contents into this device's stores, never dropping a secret already here. */
export function applyContentsLocally(addr: string, contents: VaultContents): void {
  const local = collectLocalSecrets(addr);
  const merged = mergeVaultContents(local, contents);
  for (const batch of merged.cards) {
    saveLocalBatch(addr, { ...batch, creator: addr.toLowerCase() } as StoredVoucherBatch);
  }
  writeLocalCampaigns(addr, merged.campaigns);
}

// ───────────────────────────── network ─────────────────────────────

const api = (addr: string) => `/api/vouchers/vault?creator=${encodeURIComponent(addr.toLowerCase())}`;

export class VaultAuthError extends Error {}

export async function fetchRemoteVault(addr: string): Promise<RemoteVault | null> {
  const res = await fetch(api(addr), { cache: "no-store", credentials: "include" });
  if (res.status === 401 || res.status === 403) throw new VaultAuthError("Sign in with your wallet first");
  if (!res.ok) throw new Error("Couldn't reach your backup. Try again.");
  const data = (await res.json()) as { vault?: RemoteVault | null };
  return data.vault ?? null;
}

async function putRemoteVault(
  addr: string,
  envelope: VaultEnvelope,
  baseVersion: number
): Promise<{ ok: true; vault: RemoteVault } | { ok: false; conflict: RemoteVault | null }> {
  const res = await fetch("/api/vouchers/vault", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ creator: addr.toLowerCase(), envelope, baseVersion }),
  });
  if (res.status === 409) {
    const data = (await res.json().catch(() => ({}))) as { vault?: RemoteVault | null };
    return { ok: false, conflict: data.vault ?? null };
  }
  if (res.status === 401 || res.status === 403) throw new VaultAuthError("Sign in with your wallet first");
  if (!res.ok) throw new Error("Couldn't save your backup. Try again.");
  const data = (await res.json()) as { vault: RemoteVault };
  return { ok: true, vault: data.vault };
}

export async function deleteRemoteVault(addr: string): Promise<void> {
  const res = await fetch(api(addr), { method: "DELETE", credentials: "include" });
  if (res.status === 401 || res.status === 403) throw new VaultAuthError("Sign in with your wallet first");
  if (!res.ok) throw new Error("Couldn't reset your backup. Try again.");
  setLocalVaultKey(addr, null);
}

/** Card secrets the server still holds for this creator (from before the vault). */
async function fetchServerCardSecrets(addr: string): Promise<StoredVoucherBatch[]> {
  const res = await fetch(`/api/vouchers/credentials?creator=${encodeURIComponent(addr.toLowerCase())}`, {
    cache: "no-store",
    credentials: "include",
  });
  if (res.status === 401 || res.status === 403) throw new VaultAuthError("Sign in with your wallet first");
  if (!res.ok) return [];
  const data = (await res.json()) as { batches?: StoredVoucherBatch[] };
  return data.batches ?? [];
}

// ───────────────────────────── flows ─────────────────────────────

/**
 * Step 1 of turning the vault on: gather every secret (this device + the server copy) and
 * encrypt it. Nothing is uploaded yet — the creator must confirm they saved the phrase first.
 */
export async function prepareNewVault(
  addr: string
): Promise<{ envelope: VaultEnvelope; vaultKey: string; phrase: string; contents: VaultContents }> {
  const existing = await fetchRemoteVault(addr);
  if (existing) throw new Error("A private backup already exists. Unlock it with your backup words.");
  const server = await fetchServerCardSecrets(addr);
  const contents = mergeVaultContents(collectLocalSecrets(addr), { cards: server, campaigns: [] });
  const { envelope, vaultKey, phrase } = await createVault(addr, contents);
  return { envelope, vaultKey, phrase, contents };
}

/** Step 2: upload after the phrase is confirmed. The server then deletes its copy of secrets. */
export async function commitNewVault(addr: string, envelope: VaultEnvelope, vaultKey: string, contents: VaultContents) {
  const res = await putRemoteVault(addr, envelope, 0);
  if (!res.ok) throw new Error("A private backup was just created on another device. Unlock it with that phrase.");
  setLocalVaultKey(addr, vaultKey);
  applyContentsLocally(addr, contents);
  return res.vault;
}

/** Unlock on this device with the phrase, then pull every secret down. */
export async function unlockVault(addr: string, phrase: string): Promise<VaultContents> {
  const remote = await fetchRemoteVault(addr);
  if (!remote) throw new Error("No private backup found for this wallet.");
  const key = await unlockWithPhrase(addr, remote.envelope, phrase);
  setLocalVaultKey(addr, key);
  return syncVault(addr);
}

/**
 * Two-way sync (needs the vault key here): pull, merge with this device, apply locally,
 * push if this device had anything new. Retries once if another device wrote meanwhile.
 */
export async function syncVault(addr: string): Promise<VaultContents> {
  const key = getLocalVaultKey(addr);
  if (!key) throw new Error("Unlock your private backup on this device first.");

  for (let attempt = 0; attempt < 3; attempt++) {
    const remote = await fetchRemoteVault(addr);
    if (!remote) {
      // Vault was reset elsewhere: forget the stale key so the UI offers to start over.
      setLocalVaultKey(addr, null);
      throw new Error("Your private backup was reset. Turn it on again to keep a backup.");
    }
    let remoteContents: VaultContents;
    try {
      remoteContents = await openContents(addr, key, remote.envelope);
    } catch {
      setLocalVaultKey(addr, null);
      throw new Error("This device's key no longer opens your backup. Unlock it with your backup words.");
    }
    const merged = mergeVaultContents(remoteContents, collectLocalSecrets(addr));
    applyContentsLocally(addr, merged);
    if (sameVaultSecrets(merged, remoteContents)) return merged;

    const envelope = await sealContents(addr, key, merged, remote.envelope.phraseWrap);
    const res = await putRemoteVault(addr, envelope, remote.version);
    if (res.ok) return merged;
    // conflict: loop re-reads and merges again
  }
  throw new Error("Your backup is changing on another device. Try again in a moment.");
}

/** Fire-and-forget sync after new secrets are saved on this device. */
export function syncVaultInBackground(addr: string): void {
  if (!hasLocalVaultKey(addr)) return;
  void syncVault(addr).catch(() => {
    /* shown next time the backup panel loads */
  });
}

/** New recovery phrase (old one stops working). Needs this device to be unlocked. */
export async function replaceRecoveryPhrase(addr: string): Promise<{ phrase: string; commit: () => Promise<void> }> {
  const key = getLocalVaultKey(addr);
  if (!key) throw new Error("Unlock your private backup on this device first.");
  const remote = await fetchRemoteVault(addr);
  if (!remote) throw new Error("No private backup found for this wallet.");
  const { envelope, phrase } = await rotatePhrase(addr, key, remote.envelope);
  return {
    phrase,
    commit: async () => {
      const res = await putRemoteVault(addr, envelope, remote.version);
      if (!res.ok) throw new Error("Your backup changed on another device. Try again.");
    },
  };
}
