import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import type { StoredVoucherBatch } from "@/lib/utils/voucher";
import { isSealed, openJson, sealJson } from "./secret-box";
import { decodeCredentials, encodeCredentials } from "./credentials-store";
import {
  createVault,
  isPhraseShapeValid,
  isVaultEnvelope,
  mergeVaultContents,
  openContents,
  rotatePhrase,
  sameVaultSecrets,
  sealContents,
  unlockWithPhrase,
  vaultStats,
  type VaultContents,
} from "./vault-crypto";

const ALICE = "0x00000000000000000000000000000000000a11ce";
const BOB = "0x0000000000000000000000000000000000000b0b";
const V1 = "0xe425b060d888dd54c57160f4c3b0d3fb76eccf25";
const V2 = "0xc118afff969db6cd6d2de639e2c8ba1223768fce";
const key = () => randomBytes(32).toString("base64");

function batch(batchId: number, secrets: string[], contractAddress?: string): StoredVoucherBatch {
  return {
    batchId,
    asset: "USDC",
    totalAmount: "0",
    amountPerCard: "0",
    cardCount: secrets.length,
    message: "",
    creator: ALICE,
    createdAt: 0,
    contractAddress,
    cards: secrets.map((secret, cardIndex) => ({ batchId, cardIndex, cardId: `c${cardIndex}`, secret })),
  };
}

describe("secret-box (server encryption at rest)", () => {
  it("seals and opens per creator, and a record can't be moved to another creator", () => {
    const env = { VOUCHER_SECRETS_KEY: key() } as unknown as NodeJS.ProcessEnv;
    const sealed = sealJson([{ s: "AAAA" }], ALICE, env)!;
    expect(isSealed(sealed)).toBe(true);
    expect(sealed).not.toContain("AAAA");
    expect(openJson(sealed, ALICE, env)).toEqual([{ s: "AAAA" }]);
    expect(() => openJson(sealed, BOB, env)).toThrow();
  });

  it("opens records sealed with a previous key after rotation", () => {
    const oldKey = key();
    const sealed = sealJson({ a: 1 }, ALICE, { VOUCHER_SECRETS_KEY: oldKey } as unknown as NodeJS.ProcessEnv)!;
    const rotated = { VOUCHER_SECRETS_KEY: key(), VOUCHER_SECRETS_KEY_PREVIOUS: oldKey } as unknown as NodeJS.ProcessEnv;
    expect(openJson(sealed, ALICE, rotated)).toEqual({ a: 1 });
    expect(() => openJson(sealed, ALICE, { VOUCHER_SECRETS_KEY: key() } as unknown as NodeJS.ProcessEnv)).toThrow();
  });

  it("does nothing without a (valid) key", () => {
    expect(sealJson({ a: 1 }, ALICE, {} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(sealJson({ a: 1 }, ALICE, { VOUCHER_SECRETS_KEY: "short" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe("credential record encoding", () => {
  it("flags old plaintext records for re-sealing once a key is set, and reads both forms", () => {
    const prev = process.env.VOUCHER_SECRETS_KEY;
    try {
      process.env.VOUCHER_SECRETS_KEY = key();
      const batches = [batch(1, ["AAAA"])];
      const plain = decodeCredentials(ALICE, batches);
      expect(plain).toEqual({ batches, needsReseal: true });

      const sealed = encodeCredentials(ALICE, batches);
      expect(typeof sealed).toBe("string");
      expect(JSON.stringify(sealed)).not.toContain("AAAA");
      expect(decodeCredentials(ALICE, sealed)).toEqual({ batches, needsReseal: false });

      delete process.env.VOUCHER_SECRETS_KEY;
      expect(decodeCredentials(ALICE, batches).needsReseal).toBe(false);
      expect(encodeCredentials(ALICE, batches)).toEqual(batches);
    } finally {
      if (prev === undefined) delete process.env.VOUCHER_SECRETS_KEY;
      else process.env.VOUCHER_SECRETS_KEY = prev;
    }
  });
});

describe("private vault crypto", () => {
  const contents: VaultContents = {
    cards: [batch(7, ["AAAA-BBBB", "CCCC-DDDD"], V1)],
    campaigns: [{ id: "1000000001", secret: "ab".repeat(32), createdAt: 1, asset: "USDC", slots: 10 }],
  };

  it("round-trips, and the stored envelope holds no secrets in the clear", async () => {
    const { envelope, vaultKey, phrase } = await createVault(ALICE, contents);
    expect(isVaultEnvelope(envelope)).toBe(true);
    expect(isPhraseShapeValid(phrase)).toBe(true);
    expect(JSON.stringify(envelope)).not.toContain("AAAA");
    expect(await openContents(ALICE, vaultKey, envelope)).toEqual(contents);
  });

  it("unlocks on a new device with the phrase (any case / spacing), not with a wrong one", async () => {
    const { envelope, vaultKey, phrase } = await createVault(ALICE, contents);
    const messy = `  ${phrase.toUpperCase().split(" ").join("   ")}\n`;
    expect(await unlockWithPhrase(ALICE, envelope, messy)).toBe(vaultKey);

    const other = (await createVault(ALICE, contents)).phrase;
    await expect(unlockWithPhrase(ALICE, envelope, other)).rejects.toThrow("Wrong recovery phrase");
    await expect(unlockWithPhrase(ALICE, envelope, "not a phrase")).rejects.toThrow();
  });

  it("can't be opened as another creator's vault", async () => {
    const { envelope, vaultKey, phrase } = await createVault(ALICE, contents);
    await expect(openContents(BOB, vaultKey, envelope)).rejects.toThrow();
    await expect(unlockWithPhrase(BOB, envelope, phrase)).rejects.toThrow();
  });

  it("a new phrase replaces the old one and keeps the contents", async () => {
    const { envelope, vaultKey, phrase } = await createVault(ALICE, contents);
    const rotated = await rotatePhrase(ALICE, vaultKey, envelope);
    expect(await unlockWithPhrase(ALICE, rotated.envelope, rotated.phrase)).toBe(vaultKey);
    await expect(unlockWithPhrase(ALICE, rotated.envelope, phrase)).rejects.toThrow();
    expect(await openContents(ALICE, vaultKey, rotated.envelope)).toEqual(contents);
  });

  it("re-sealing keeps the phrase wrap working", async () => {
    const { envelope, vaultKey, phrase } = await createVault(ALICE, contents);
    const more = mergeVaultContents(contents, { cards: [batch(8, ["EEEE"], V2)], campaigns: [] });
    const next = await sealContents(ALICE, vaultKey, more, envelope.phraseWrap);
    const k = await unlockWithPhrase(ALICE, next, phrase);
    expect(vaultStats(await openContents(ALICE, k, next))).toEqual({ batches: 2, cards: 3, links: 1 });
  });

  it("rejects malformed envelopes", () => {
    expect(isVaultEnvelope(null)).toBe(false);
    expect(isVaultEnvelope({ v: 1, phraseWrap: {}, data: {}, updatedAt: 1 })).toBe(false);
    expect(isVaultEnvelope({ v: 2, phraseWrap: { iv: "a", ct: "b", salt: "c" }, data: { iv: "a", ct: "b" }, updatedAt: 1 })).toBe(false);
  });
});

describe("vault merging", () => {
  it("never replaces a secret with an empty one, and joins legacy (contract-less) records", () => {
    const a: VaultContents = { cards: [batch(1, ["AAAA", ""])], campaigns: [] };
    const b: VaultContents = { cards: [batch(1, ["", "BBBB"], V1)], campaigns: [] };
    const m = mergeVaultContents(a, b);
    expect(m.cards).toHaveLength(1);
    expect(m.cards[0]!.contractAddress).toBe(V1);
    expect(m.cards[0]!.cards.map((c) => c.secret)).toEqual(["AAAA", "BBBB"]);
  });

  it("keeps same-id batches on different contracts apart", () => {
    const m = mergeVaultContents(
      { cards: [batch(1, ["AAAA"], V1)], campaigns: [] },
      { cards: [batch(1, ["ZZZZ"], V2)], campaigns: [] }
    );
    expect(m.cards).toHaveLength(2);
  });

  it("dedupes one-link keys and detects when nothing new needs uploading", () => {
    const link = { id: "5", secret: "s", createdAt: 1, asset: "ETH", slots: 1 };
    const a: VaultContents = { cards: [batch(1, ["AAAA"], V1)], campaigns: [link] };
    const m = mergeVaultContents(a, { cards: [], campaigns: [link] });
    expect(m.campaigns).toHaveLength(1);
    expect(sameVaultSecrets(m, a)).toBe(true);
    expect(sameVaultSecrets(m, mergeVaultContents(a, { cards: [batch(2, ["X"], V1)], campaigns: [] }))).toBe(false);
  });
});
