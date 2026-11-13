import { describe, expect, it } from "vitest";
import {
  buildCampaignLink,
  buildCampaignShortLink,
  buildSenderIdentity,
  campaignStatus,
  campaignTicketInnerHash,
  explainCampaignError,
  campaignLinkInnerHash,
  campaignLinkSigner,
  generateCampaignSecret,
  isValidCampaignSecret,
  signCampaignLink,
  verifyCampaignLinkSig,
  parseCampaignLink,
  validateCampaignInput,
  type OnchainCampaign,
} from "./campaign";

const base: OnchainCampaign = {
  creator: "0x00000000000000000000000000000000000000c1",
  token: "0x0000000000000000000000000000000000000000",
  amountPerClaim: 1n,
  maxClaims: 50,
  claimedCount: 0,
  unlockAt: 0,
  expiresAt: 0,
  claimSigner: "0x0000000000000000000000000000000000000000",
  linkSigner: "0x00000000000000000000000000000000000000dd",
  committed: false,
  closed: false,
};

const input = {
  asset: "USDC",
  total: "50",
  maxClaims: 50,
  message: "gm",
  senderLabel: "me.base.eth",
  committed: false,
  gated: true,
};

describe("campaign link keys & links", () => {
  it("generates unique 256-bit link keys", () => {
    const a = generateCampaignSecret();
    const b = generateCampaignSecret();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(isValidCampaignSecret(a)).toBe(true);
    expect(campaignLinkSigner(a)).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("keeps the link key in the URL fragment, never the query/path", () => {
    const key = "a".repeat(64);
    for (const link of [buildCampaignLink(12, key, "https://x.app/"), buildCampaignShortLink(12, key, "https://x.app")]) {
      const u = new URL(link);
      expect(u.search.includes(key)).toBe(false);
      expect(u.pathname.includes(key)).toBe(false);
      expect(u.hash.includes(key)).toBe(true);
    }
  });

  it("round-trips both link shapes", () => {
    const key = "b".repeat(64);
    const long = new URL(buildCampaignLink(7, key, "https://x.app"));
    expect(parseCampaignLink({ pathname: long.pathname, search: long.search, hash: long.hash })).toEqual({ campaignId: "7", secret: key });
    const short = new URL(buildCampaignShortLink(7, key, "https://x.app"));
    expect(parseCampaignLink({ pathname: short.pathname, search: short.search, hash: short.hash })).toEqual({ campaignId: "7", secret: key });
  });

  it("rejects junk ids and malformed keys", () => {
    expect(parseCampaignLink({ hash: "#camp=abc&k=" + "a".repeat(64) }).campaignId).toBeNull();
    expect(parseCampaignLink({ hash: "#camp=1&k=short" }).secret).toBeNull();
    expect(parseCampaignLink({ hash: "#camp=1&k=" + "a".repeat(40) }).secret).toBeNull(); // v1-style secret
    expect(parseCampaignLink({ hash: "#camp=1&k=" + "x".repeat(64) }).secret).toBeNull();
  });
});

describe("wallet-bound link proofs (fix for Vercel Security Review base-analytics-app/1)", () => {
  const key = generateCampaignSecret();
  const ctx = { chainId: 8453, contract: "0x00000000000000000000000000000000000000aa" as const, campaignId: 3n };
  const alice = "0x000000000000000000000000000000000000a11c" as const;
  const mallory = "0x000000000000000000000000000000000000ba0d" as const;

  it("accepts the proof for the wallet it was made for", async () => {
    const sig = await signCampaignLink(key, { ...ctx, claimer: alice });
    expect(await verifyCampaignLinkSig({ ...ctx, claimer: alice, linkSigner: campaignLinkSigner(key), signature: sig })).toBe(true);
  });

  it("rejects a published proof replayed for another wallet, campaign or chain", async () => {
    const sig = await signCampaignLink(key, { ...ctx, claimer: alice });
    const signer = campaignLinkSigner(key);
    expect(await verifyCampaignLinkSig({ ...ctx, claimer: mallory, linkSigner: signer, signature: sig })).toBe(false);
    expect(await verifyCampaignLinkSig({ ...ctx, campaignId: 4n, claimer: alice, linkSigner: signer, signature: sig })).toBe(false);
    expect(await verifyCampaignLinkSig({ ...ctx, chainId: 1, claimer: alice, linkSigner: signer, signature: sig })).toBe(false);
  });

  it("rejects a proof made with a different link key", async () => {
    const sig = await signCampaignLink(generateCampaignSecret(), { ...ctx, claimer: alice });
    expect(await verifyCampaignLinkSig({ ...ctx, claimer: alice, linkSigner: campaignLinkSigner(key), signature: sig })).toBe(false);
  });

  it("keeps link proofs and tickets in separate domains", () => {
    const args = { ...ctx, claimer: alice };
    expect(campaignLinkInnerHash(args)).not.toBe(campaignTicketInnerHash({ ...args, deadline: 0n }));
  });
});

describe("claim tickets", () => {
  it("binds the ticket hash to chain, contract, campaign, claimer and deadline", () => {
    const args = {
      chainId: 8453,
      contract: "0x00000000000000000000000000000000000000aa" as const,
      campaignId: 1n,
      claimer: "0x00000000000000000000000000000000000000bb" as const,
      deadline: 1_800_000_600n,
    };
    const h = campaignTicketInnerHash(args);
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
    expect(campaignTicketInnerHash({ ...args, chainId: 1 })).not.toBe(h);
    expect(campaignTicketInnerHash({ ...args, campaignId: 2n })).not.toBe(h);
    expect(campaignTicketInnerHash({ ...args, deadline: args.deadline + 1n })).not.toBe(h);
    expect(campaignTicketInnerHash({ ...args, claimer: "0x00000000000000000000000000000000000000cc" })).not.toBe(h);
  });
});

describe("validateCampaignInput", () => {
  const now = 1_800_000_000;
  it("accepts a normal campaign", () => {
    expect(validateCampaignInput({ ...input, expiresAt: now + 86_400 }, now).ok).toBe(true);
  });
  it("enforces slot bounds up to 1000", () => {
    expect(validateCampaignInput({ ...input, maxClaims: 0 }, now).ok).toBe(false);
    expect(validateCampaignInput({ ...input, maxClaims: 1000 }, now).ok).toBe(true);
    expect(validateCampaignInput({ ...input, maxClaims: 1001 }, now).ok).toBe(false);
    expect(validateCampaignInput({ ...input, maxClaims: 2.5 }, now).ok).toBe(false);
  });
  it("rejects bad amounts, long text, and committed-without-expiry", () => {
    expect(validateCampaignInput({ ...input, total: "0" }, now).ok).toBe(false);
    expect(validateCampaignInput({ ...input, total: "abc" }, now).ok).toBe(false);
    expect(validateCampaignInput({ ...input, message: "x".repeat(281) }, now).ok).toBe(false);
    expect(validateCampaignInput({ ...input, senderLabel: "x".repeat(41) }, now).ok).toBe(false);
    expect(validateCampaignInput({ ...input, committed: true }, now).ok).toBe(false);
    expect(validateCampaignInput({ ...input, expiresAt: now + 5 }, now).ok).toBe(false);
  });
  it("warns about open claims and missing expiry", () => {
    const v = validateCampaignInput({ ...input, gated: false }, now);
    expect(v.warnings.length).toBe(2);
  });
});

describe("campaignStatus", () => {
  it("covers every state", () => {
    expect(campaignStatus(base, 100)).toBe("open");
    expect(campaignStatus({ ...base, closed: true }, 100)).toBe("closed");
    expect(campaignStatus({ ...base, expiresAt: 50 }, 100)).toBe("expired");
    expect(campaignStatus({ ...base, claimedCount: 50 }, 100)).toBe("full");
    expect(campaignStatus({ ...base, unlockAt: 500 }, 100)).toBe("locked");
  });
});

describe("sender identity", () => {
  const addr = "0x00000000000000000000000000000000000000c1";
  it("marks a matching basename as verified", () => {
    expect(buildSenderIdentity(addr, "Alice.base.eth", "alice.base.eth").trust).toBe("basename-verified");
    expect(buildSenderIdentity(addr, "", "alice.base.eth").trust).toBe("basename-verified");
  });
  it("never verifies a typed name that is not the wallet's own basename", () => {
    expect(buildSenderIdentity(addr, "coinbase.base.eth", "alice.base.eth").trust).toBe("unverified-label");
    expect(buildSenderIdentity(addr, "coinbase.base.eth", null).trust).toBe("unverified-label");
  });
  it("falls back to address only", () => {
    expect(buildSenderIdentity(addr, "", null).trust).toBe("address-only");
  });
});

describe("explainCampaignError", () => {
  it("maps contract reverts to friendly text and hides raw errors", () => {
    expect(explainCampaignError("execution reverted: All claims taken")).toMatch(/too late/);
    expect(explainCampaignError("execution reverted: Already claimed")).toMatch(/already claimed/);
    expect(explainCampaignError("0xdeadbeef weird rpc error")).toMatch(/Nothing was sent/);
  });
});
