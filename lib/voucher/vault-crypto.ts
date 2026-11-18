/**
 * Private vault for gift secrets: end-to-end encrypted in the creator's browser.
 *
 * - A random 256-bit vault key encrypts the contents (card secrets + one-link keys) with
 *   AES-GCM. The server only ever stores the encrypted envelope.
 * - The vault key is wrapped by a 12-word recovery phrase (BIP-39 English words, 128 bits of
 *   entropy), so any device can unlock it with the phrase. HKDF is enough here because the
 *   phrase is random, not a user-chosen password.
 * - The creator address is bound as AAD everywhere, so an envelope can't be moved to another
 *   creator's slot and still open.
 *
 * Works in browsers and Node (WebCrypto `crypto.subtle`).
 */
import { english, generateMnemonic } from "viem/accounts";
import type { StoredVoucherBatch } from "@/lib/utils/voucher";

export const VAULT_VERSION = 1 as const;
export const PHRASE_WORDS = 12;

/** A one-link gift key saved by the creator (same shape the campaign panel keeps locally). */
export interface VaultCampaignLink {
  id: string;
  secret: string;
  createdAt: number;
  asset: string;
  slots: number;
}

export interface VaultContents {
  cards: StoredVoucherBatch[];
  campaigns: VaultCampaignLink[];
}

interface Sealed {
  iv: string;
  ct: string;
}

export interface VaultEnvelope {
  v: typeof VAULT_VERSION;
  /** Vault key wrapped by the recovery phrase. */
  phraseWrap: Sealed & { salt: string };
  /** Contents encrypted with the vault key. */
  data: Sealed;
  updatedAt: number;
}

const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("This browser can't encrypt (WebCrypto unavailable)");
  return s;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

const aad = (creator: string, part: string) => enc.encode(`base-voucher-vault-v1|${creator.toLowerCase()}|${part}`);

// ───────────────────────────── recovery phrase ─────────────────────────────

const WORDS = new Set(english);

export function generateRecoveryPhrase(): string {
  return generateMnemonic(english, 128);
}

export function normalizePhrase(input: string): string {
  return input.trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

/** Shape check only (12 known words). A wrong-but-valid phrase is caught when unwrapping. */
export function isPhraseShapeValid(input: string): boolean {
  const words = normalizePhrase(input).split(" ");
  return words.length === PHRASE_WORDS && words.every((w) => WORDS.has(w));
}

async function phraseKey(phrase: string, salt: Uint8Array<ArrayBuffer>, creator: string): Promise<CryptoKey> {
  const ikm = await subtle().importKey("raw", enc.encode(normalizePhrase(phrase)), "HKDF", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: aad(creator, "phrase") },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ───────────────────────────── vault key ─────────────────────────────

/** A fresh vault key, base64 (kept in this browser so the creator doesn't retype the phrase). */
export function generateVaultKey(): string {
  return toB64(randomBytes(32));
}

async function importVaultKey(keyB64: string): Promise<CryptoKey> {
  const raw = fromB64(keyB64);
  if (raw.length !== 32) throw new Error("Invalid vault key");
  return subtle().importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function seal(key: CryptoKey, plaintext: Uint8Array<ArrayBuffer>, additional: Uint8Array<ArrayBuffer>): Promise<Sealed> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv, additionalData: additional }, key, plaintext));
  return { iv: toB64(iv), ct: toB64(ct) };
}

async function open(key: CryptoKey, s: Sealed, additional: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(
    await subtle().decrypt({ name: "AES-GCM", iv: fromB64(s.iv), additionalData: additional }, key, fromB64(s.ct))
  );
}

async function wrapWithPhrase(creator: string, vaultKeyB64: string, phrase: string): Promise<VaultEnvelope["phraseWrap"]> {
  const salt = randomBytes(16);
  const sealed = await seal(await phraseKey(phrase, salt, creator), fromB64(vaultKeyB64), aad(creator, "wrap"));
  return { ...sealed, salt: toB64(salt) };
}

// ───────────────────────────── envelope ─────────────────────────────

/** Brand-new vault: returns the envelope to upload, the key to keep locally and the phrase to show once. */
export async function createVault(
  creator: string,
  contents: VaultContents
): Promise<{ envelope: VaultEnvelope; vaultKey: string; phrase: string }> {
  const phrase = generateRecoveryPhrase();
  const vaultKey = generateVaultKey();
  const phraseWrap = await wrapWithPhrase(creator, vaultKey, phrase);
  const envelope = await sealContents(creator, vaultKey, contents, phraseWrap);
  return { envelope, vaultKey, phrase };
}

/** Re-encrypt contents with the vault key, keeping the existing phrase wrap. */
export async function sealContents(
  creator: string,
  vaultKey: string,
  contents: VaultContents,
  phraseWrap: VaultEnvelope["phraseWrap"]
): Promise<VaultEnvelope> {
  const data = await seal(await importVaultKey(vaultKey), enc.encode(JSON.stringify(contents)), aad(creator, "data"));
  return { v: VAULT_VERSION, phraseWrap, data, updatedAt: Date.now() };
}

/** Decrypt contents. Throws if the key doesn't belong to this envelope or it was tampered with. */
export async function openContents(creator: string, vaultKey: string, envelope: VaultEnvelope): Promise<VaultContents> {
  const pt = await open(await importVaultKey(vaultKey), envelope.data, aad(creator, "data"));
  const parsed = JSON.parse(dec.decode(pt)) as Partial<VaultContents>;
  return {
    cards: Array.isArray(parsed.cards) ? parsed.cards : [],
    campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
  };
}

/** Recover the vault key from the phrase. Throws "Wrong recovery phrase" when it doesn't match. */
export async function unlockWithPhrase(creator: string, envelope: VaultEnvelope, phrase: string): Promise<string> {
  if (!isPhraseShapeValid(phrase)) throw new Error("A recovery phrase is 12 words from the list");
  try {
    const raw = await open(
      await phraseKey(phrase, fromB64(envelope.phraseWrap.salt), creator),
      envelope.phraseWrap,
      aad(creator, "wrap")
    );
    return toB64(raw);
  } catch {
    throw new Error("Wrong recovery phrase");
  }
}

/** Replace the recovery phrase (needs the vault key, i.e. an unlocked device). */
export async function rotatePhrase(
  creator: string,
  vaultKey: string,
  envelope: VaultEnvelope
): Promise<{ envelope: VaultEnvelope; phrase: string }> {
  // Proves the key opens this vault before re-wrapping it.
  await openContents(creator, vaultKey, envelope);
  const phrase = generateRecoveryPhrase();
  const phraseWrap = await wrapWithPhrase(creator, vaultKey, phrase);
  return { envelope: { ...envelope, phraseWrap, updatedAt: Date.now() }, phrase };
}

/** Structural check for an envelope received from the network. */
export function isVaultEnvelope(x: unknown): x is VaultEnvelope {
  const e = x as VaultEnvelope;
  const str = (v: unknown) => typeof v === "string" && v.length > 0 && v.length < 2_000_000;
  return Boolean(
    e &&
      e.v === VAULT_VERSION &&
      e.phraseWrap &&
      str(e.phraseWrap.iv) &&
      str(e.phraseWrap.ct) &&
      str(e.phraseWrap.salt) &&
      e.data &&
      str(e.data.iv) &&
      str(e.data.ct) &&
      Number.isFinite(e.updatedAt)
  );
}

// ───────────────────────────── merging ─────────────────────────────

const batchKey = (b: StoredVoucherBatch) => `${b.contractAddress?.toLowerCase() ?? "?"}:${b.batchId}`;

/**
 * Union of two vault contents. Cards merge per card: a non-empty secret is never replaced by an
 * empty one. A batch saved without a contract merges into the same id with a contract.
 */
export function mergeVaultContents(a: VaultContents, b: VaultContents): VaultContents {
  const cards = new Map<string, StoredVoucherBatch>();
  const add = (batch: StoredVoucherBatch) => {
    if (!batch || !Number.isInteger(batch.batchId)) return;
    let key = batchKey(batch);
    if (!cards.has(key)) {
      // Pair a contract-less record with the same id that has a contract (or vice versa).
      const twin = [...cards.entries()].find(
        ([, x]) => x.batchId === batch.batchId && (!x.contractAddress || !batch.contractAddress)
      );
      if (twin) key = twin[0];
    }
    const prev = cards.get(key);
    if (!prev) {
      cards.set(key, { ...batch, cards: [...(batch.cards ?? [])] });
      return;
    }
    const byIndex = new Map(prev.cards.map((c) => [c.cardIndex, c]));
    for (const c of batch.cards ?? []) {
      const old = byIndex.get(c.cardIndex);
      if (!old || (!old.secret?.trim() && c.secret?.trim())) byIndex.set(c.cardIndex, c);
    }
    const merged = {
      ...prev,
      contractAddress: prev.contractAddress ?? batch.contractAddress,
      cards: [...byIndex.values()].sort((x, y) => x.cardIndex - y.cardIndex),
    };
    cards.delete(key);
    cards.set(batchKey(merged), merged);
  };
  for (const batch of a.cards) add(batch);
  for (const batch of b.cards) add(batch);

  const campaigns = new Map<string, VaultCampaignLink>();
  for (const c of [...a.campaigns, ...b.campaigns]) {
    if (c?.id && c.secret && !campaigns.has(c.id)) campaigns.set(c.id, c);
  }

  return {
    cards: [...cards.values()].sort((x, y) => y.batchId - x.batchId),
    campaigns: [...campaigns.values()].sort((x, y) => y.createdAt - x.createdAt),
  };
}

/** Same secrets in both (ignoring order and metadata)? Used to skip needless uploads. */
export function sameVaultSecrets(a: VaultContents, b: VaultContents): boolean {
  const fp = (c: VaultContents) =>
    JSON.stringify([
      c.cards
        .map((x) => [batchKey(x), x.cards.filter((k) => k.secret?.trim()).map((k) => [k.cardIndex, k.secret.trim()])])
        .sort(),
      c.campaigns.map((x) => [x.id, x.secret]).sort(),
    ]);
  return fp(a) === fp(b);
}

/** Counts for the UI. */
export function vaultStats(c: VaultContents): { batches: number; cards: number; links: number } {
  return {
    batches: c.cards.length,
    cards: c.cards.reduce((n, b) => n + b.cards.filter((k) => k.secret?.trim()).length, 0),
    links: c.campaigns.length,
  };
}
