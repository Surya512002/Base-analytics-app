import { describe, expect, it } from "vitest";
import {
  buildCampaignLink,
  buildCampaignShortLink,
  buildSenderIdentity,
  campaignStatus,
  campaignTicketInnerHash,
  explainCampaignError,
  generateCampaignSecret,
  hashCampaignSecret,
  isValidCampaignSecret,
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

describe("campaign secrets & links", () => {
  it("generates unique, valid 160-bit secrets", () => {
    const a = generateCampaignSecret();
    const b = generateCampaignSecret();
    expect(a).toMatch(/^[0-9a-f]{40}$/);
    expect(a).not.toBe(b);
    expect(isValidCampaignSecret(a)).toBe(true);
  });

  it("hashes deterministically (matches contract keccak256(abi.encodePacked(secret)))", () => {
    expect(hashCampaignSecret("abc")).toBe(
      "0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45"
    );
  });

  it("keeps the secret in the URL fragment, never the query/path", () => {
    const secret = "a".repeat(40);
    for (const link of [buildCampaignLink(12, secret, "https://x.app/"), buildCampaignShortLink(12, secret, "https://x.app")]) {
      const u = new URL(link);
      expect(u.search.includes(secret)).toBe(false);
      expect(u.pathname.includes(secret)).toBe(false);
      expect(u.hash.includes(secret)).toBe(true);
    }
  });

  it("round-trips both link shapes", () => {
    const secret = "b".repeat(40);
    const long = new URL(buildCampaignLink(7, secret, "https://x.app"));
    expect(parseCampaignLink({ pathname: long.pathname, search: long.search, hash: long.hash })).toEqual({
      campaignId: "7",
      secret,
    });
    const short = new URL(buildCampaignShortLink(7, secret, "https://x.app"));
    expect(parseCampaignLink({ pathname: short.pathname, search: short.search, hash: short.hash })).toEqual({
      campaignId: "7",
      secret,
    });
  });

  it("rejects junk ids and weak secrets", () => {
    expect(parseCampaignLink({ hash: "#camp=abc&k=" + "a".repeat(40) }).campaignId).toBeNull();
    expect(parseCampaignLink({ hash: "#camp=1&k=short" }).secret).toBeNull();
    expect(parseCampaignLink({ hash: "#camp=1&k=" + "x".repeat(200) }).secret).toBeNull();
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
    expect(
      campaignTicketInnerHash({ ...args, claimer: "0x00000000000000000000000000000000000000cc" })
    ).not.toBe(h);
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
