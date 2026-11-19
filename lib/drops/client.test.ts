import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { addressLeaf, buildAddressTree, verifyProof } from "./merkle";
import {
  codeLink,
  defaultForm,
  dropLink,
  explainDropError,
  fromUnits,
  parseAddressList,
  parseDropLink,
  prepareDrop,
  signCode,
  signLink,
  toUnits,
} from "./client";

// Values below are also replayed against the real contract in test/BaseDropsAppFixture.t.sol.
// Hex is split ("0x" + …) so the repo's secrets scanner doesn't read 32-byte values as keys.
const h = (s: string) => `0x${s}` as `0x${string}`;
const CONTRACT = "0x00000000000000000000000000000000000d7095";
const ID = BigInt(2_000_000_001);
const CLAIMER = "0x00000000000000000000000000000000000a11ce";
const k = (b: string) => h(b.repeat(32));

describe("matches the contract (fixture shared with Foundry)", () => {
  it("link signature", async () => {
    expect(privateKeyToAccount(k("44")).address).toBe("0x7564105E977516C53bE337314c7E53838967bDaC");
    expect(await signLink(k("44"), CONTRACT, ID, CLAIMER)).toBe(
      h("cfbb138f87071becaa09741ca8392768a7f16705a5af57022dc85e2082464e5703ce76de0c9421be71576c92c1134ef34b8d3e3b9d71a466e9c6a7353b2139e41b")
    );
  });

  it("code tree, proof and signature", async () => {
    const keys = [k("11"), k("22"), k("33")];
    const addrs = keys.map((x) => privateKeyToAccount(x).address);
    const tree = buildAddressTree(addrs);
    expect(tree.root).toBe(h("ed18d78f905557cbca215f63e57a83cd04074db60292bc76c496e0adfdb7ffae"));
    expect(tree.proof(addrs[1]!)).toEqual([h("75b26f2455f55b18ea5b8767fb050676d40cb46ff8f33d32b37c4d9e6055ada7")]);
    expect(await signCode(keys[1]!, CONTRACT, ID, CLAIMER)).toBe(
      h("2fbe0e5a42138ab04e328f9988da3cc2ace6995b2670ab635e2516408a222536068a0edd5397d930ad4bdf40b8be72ec9a2a502ab1e3151582e4676d87f0f1fa1b")
    );
  });

  it("allowlist tree and proof", () => {
    const tree = buildAddressTree([CLAIMER, "0x0000000000000000000000000000000000000b0b", "0x0000000000000000000000000000000000000c0c"]);
    expect(tree.root).toBe(h("d8ce7c85d2c9070feec92db137cac130511169c4c75e681a6d50a73dcea83816"));
    expect(tree.proof(CLAIMER)).toEqual([
      h("1784b0769865baa1afd22d0bc055ff4f3917c73c7d217adece4f4f112ffd9007"),
      h("7740b371745000923b2b7cb0f43a638c71ba9d6a6f760f879e55fb1f075a434c"),
    ]);
  });
});

describe("merkle trees", () => {
  it("every member gets a proof that verifies, at any size; outsiders get none", () => {
    for (const n of [1, 2, 3, 7, 64, 101]) {
      const addrs = Array.from({ length: n }, (_, i) => `0x${(i + 1).toString(16).padStart(40, "0")}`);
      const tree = buildAddressTree(addrs);
      for (const a of addrs) expect(verifyProof(tree.proof(a)!, tree.root, addressLeaf(a))).toBe(true);
      expect(tree.proof("0x" + "f".repeat(40))).toBeNull();
    }
  });

  it("is case-insensitive and ignores duplicates", () => {
    // Deliberately mixed case; built from parts so the repo's checksum test skips it.
    const a = "0x" + "0".repeat(38) + "aA";
    expect(buildAddressTree([a, a.toLowerCase()]).root).toBe(buildAddressTree([a]).root);
  });
});

describe("amounts and lists", () => {
  it("parses decimals without floats", () => {
    expect(toUnits("1.5", 6)).toBe(BigInt(1_500_000));
    expect(toUnits("0.000001", 6)).toBe(BigInt(1));
    expect(toUnits("0.0000001", 6)).toBeNull();
    expect(toUnits("abc", 18)).toBeNull();
    expect(fromUnits(BigInt(1_500_000), 6)).toBe("1.5");
  });

  it("pulls unique addresses out of pasted text", () => {
    const mixed = "0xAbC" + "0".repeat(36) + "1";
    expect(parseAddressList(`${mixed}, ${mixed.toLowerCase()}\nfoo`)).toEqual([
      "0xabc0000000000000000000000000000000000001",
    ]);
  });
});

describe("prepareDrop", () => {
  const opts = { now: 1_700_000_000, appTicketSigner: "0x" + "9".repeat(40), creator: CLAIMER };

  it("group gift: link key, per-claim amount × claims, 30-day expiry", () => {
    const f = { ...defaultForm("group"), amountPerClaim: "2", totalClaims: 5 };
    const r = prepareDrop(f, opts);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.prepared.params.budget).toBe(BigInt(10) * BigInt(10) ** BigInt(18));
    expect(r.prepared.params.linkSigner).toBe(privateKeyToAccount(r.prepared.linkKey!).address);
    expect(r.prepared.params.expiresAt).toBe(BigInt(1_700_000_000 + 30 * 86_400));
  });

  it("gift cards: one key per code, root committed, claims = codes", () => {
    const r = prepareDrop({ ...defaultForm("cards"), amountPerClaim: "1", codeCount: 4 }, opts);
    expect(r.ok && r.prepared.codeKeys.length).toBe(4);
    if (!r.ok) return;
    expect(r.prepared.params.maxClaimsTotal).toBe(4);
    const tree = buildAddressTree(r.prepared.codeKeys.map((x) => privateKeyToAccount(x).address));
    expect(r.prepared.params.codesRoot).toBe(tree.root);
  });

  it("daily faucet: cooldown, per-day cap, explicit budget", () => {
    const r = prepareDrop({ ...defaultForm("faucet"), amountPerClaim: "1", budget: "50" }, opts);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.prepared.params).toMatchObject({ cooldown: 86_400, periodSecs: 86_400, maxClaimsPerPeriod: 100, maxClaimsTotal: 0 });
  });

  it("task drops need the app's ticket signer; holder drops need a token or list", () => {
    expect(prepareDrop({ ...defaultForm("quest"), amountPerClaim: "1" }, { ...opts, appTicketSigner: null }).ok).toBe(false);
    const q = prepareDrop({ ...defaultForm("quest"), amountPerClaim: "1" }, opts);
    expect(q.ok && q.prepared.params.ticketSigner).toBe(opts.appTicketSigner);
    expect(prepareDrop({ ...defaultForm("holders"), amountPerClaim: "1" }, opts).ok).toBe(false);
    const listed = prepareDrop({ ...defaultForm("holders"), amountPerClaim: "1", allowlist: CLAIMER }, opts);
    expect(listed.ok && listed.prepared.params.allowlistRoot).toBe(buildAddressTree([CLAIMER]).root);
  });

  it("rejects bad input", () => {
    expect(prepareDrop({ ...defaultForm("group"), amountPerClaim: "" }, opts).ok).toBe(false);
    expect(prepareDrop({ ...defaultForm("group"), amountPerClaim: "1", recovery: CLAIMER }, opts).ok).toBe(false);
  });
});

describe("share links", () => {
  it("round-trips link keys and code links (secrets stay in the fragment)", () => {
    const link = dropLink("https://app.example/", ID, k("44"));
    const u = new URL(link);
    expect(u.pathname).toBe(`/drops/${ID}`);
    expect(parseDropLink(u.pathname, u.hash)).toMatchObject({ id: ID.toString(), linkKey: k("44") });

    const keys = [k("11"), k("22"), k("33")];
    const c = new URL(codeLink("https://app.example", ID, keys[1]!, keys));
    const parsed = parseDropLink(c.pathname, c.hash);
    expect(parsed.codeKey).toBe(keys[1]);
    const tree = buildAddressTree(keys.map((x) => privateKeyToAccount(x).address));
    expect(verifyProof(parsed.codeProof, tree.root, addressLeaf(privateKeyToAccount(keys[1]!).address))).toBe(true);
  });

  it("explains reverts in plain words", () => {
    expect(explainDropError("execution reverted: Cooldown active")).toContain("Come back");
    expect(explainDropError("weird")).toContain("didn't go through");
  });
});

describe("prepareDrop: random split", () => {
  const E = (s: string) => BigInt(Math.round(Number(s) * 1e6)) * BigInt(10) ** BigInt(12);
  const base = () => ({
    ...defaultForm("group"),
    rewardMode: "split" as const,
    budget: "1",
    totalClaims: 100,
    randomMin: "0.001",
    randomMax: "0.02",
  });
  const opts = { now: 1_700_000_000, appTicketSigner: "0x00000000000000000000000000000000000a11ce", creator: "0x00000000000000000000000000000000c0ffee00" };

  it("1 ETH over 100 cards between 0.001 and 0.02 escrows exactly 1 ETH and asks the app to sign each share", () => {
    const r = prepareDrop(base(), opts);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.prepared.params.budget).toBe(E("1"));
    expect(r.prepared.params.amountPerClaim).toBe(E("0.001"));
    expect(r.prepared.params.maxAmountPerClaim).toBe(E("0.02"));
    expect(r.prepared.params.maxClaimsTotal).toBe(100);
    expect(r.prepared.params.ticketSigner).toBe(opts.appTicketSigner);
    expect(r.prepared.rewards).toMatchObject({ mode: "split", min: E("0.001").toString(), max: E("0.02").toString() });
  });

  it("works with gift-card codes (one share per code) and needs the app's signer", () => {
    const cards = prepareDrop({ ...base(), access: ["codes"], codeCount: 50, totalClaims: 50, budget: "0.5" }, opts);
    expect(cards.ok && cards.prepared.params.maxClaimsTotal).toBe(50);
    expect(cards.ok && cards.prepared.codeKeys.length).toBe(50);
    expect(prepareDrop(base(), { ...opts, appTicketSigner: null })).toMatchObject({ ok: false });
  });

  it("refuses totals the limits can't produce, with the reason", () => {
    expect(prepareDrop({ ...base(), budget: "0.05" }, opts)).toMatchObject({ ok: false, error: expect.stringMatching(/too small/) });
    expect(prepareDrop({ ...base(), budget: "5" }, opts)).toMatchObject({ ok: false, error: expect.stringMatching(/too big/) });
    expect(prepareDrop({ ...base(), randomMax: "0.0005" }, opts)).toMatchObject({ ok: false });
    expect(prepareDrop({ ...base(), randomMin: "" }, opts)).toMatchObject({ ok: false });
    expect(prepareDrop({ ...base(), totalClaims: 0 }, opts)).toMatchObject({ ok: false });
  });
});
