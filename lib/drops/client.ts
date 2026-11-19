/**
 * Browser helpers for Drops: presets, the create form → contract params, link keys and one-time
 * codes, share links, and the claim arguments the contract expects. No React here.
 */
import { encodeAbiParameters, keccak256, stringToBytes, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { buildAddressTree } from "./merkle";

export { DROPS_CHAIN_ID } from "./network";
import { DROPS_CHAIN_ID } from "./network";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
export const ZERO_BYTES32 = `0x${"0".repeat(64)}` as Hex;
const LINK_TAG = keccak256(stringToBytes("BaseDrops.v1.link"));
const CODE_TAG = keccak256(stringToBytes("BaseDrops.v1.code"));

/** BaseDrops address, or "" until it's deployed and configured. */
export const DROPS_CONTRACT = (() => {
  const raw = (process.env.NEXT_PUBLIC_DROPS_CONTRACT || "").trim();
  return /^0x[0-9a-fA-F]{40}$/.test(raw) ? (raw as `0x${string}`) : ("" as const);
})();
export const DROPS_TOKEN_GATE = (() => {
  const raw = (process.env.NEXT_PUBLIC_DROPS_TOKEN_GATE || "").trim();
  return /^0x[0-9a-fA-F]{40}$/.test(raw) ? (raw as `0x${string}`) : ("" as const);
})();

// ───────────────────────────── presets ─────────────────────────────

export type Access = "link" | "codes" | "allowlist" | "holders" | "tasks";

export interface DropForm {
  preset: PresetId;
  /** Asset: "ETH", "USDC" or a token address. */
  token: `0x${string}`;
  symbol: string;
  decimals: number;
  /** Human amounts as typed. */
  amountPerClaim: string;
  totalClaims: number; // 0 = until the budget runs out (needs budget)
  budget: string; // human; used when totalClaims = 0
  maxClaimsPerWallet: number; // 0 = unlimited
  cooldownHours: number; // 0 = none
  perDayCap: number; // 0 = none
  unlockInHours: number;
  expiresInDays: number;
  access: Access[];
  codeCount: number;
  allowlist: string; // pasted addresses
  holderToken: string;
  holderMin: string; // human, in holderToken units
  holderDecimals: number;
  committed: boolean;
  recovery: string;
  message: string;
  senderLabel: string;
}

export type PresetId = "friend" | "group" | "cards" | "faucet" | "quest" | "daily-quest" | "holders";

export const PRESETS: Array<{ id: PresetId; title: string; note: string; patch: Partial<DropForm> }> = [
  { id: "friend", title: "Gift a friend", note: "One private link, one claim.", patch: { access: ["link"], totalClaims: 1, maxClaimsPerWallet: 1 } },
  { id: "group", title: "Group gift", note: "One link, the first N wallets each get a share.", patch: { access: ["link"], totalClaims: 10, maxClaimsPerWallet: 1 } },
  { id: "cards", title: "Gift cards", note: "N unique codes, each works once.", patch: { access: ["codes"], codeCount: 10, totalClaims: 10, maxClaimsPerWallet: 1 } },
  {
    id: "faucet",
    title: "Daily faucet",
    note: "Anyone with the link claims once every 24 hours, with a daily cap.",
    patch: { access: ["link"], totalClaims: 0, maxClaimsPerWallet: 0, cooldownHours: 24, perDayCap: 100 },
  },
  { id: "quest", title: "Community quest", note: "Wallets finish tasks, then claim once.", patch: { access: ["tasks"], totalClaims: 100, maxClaimsPerWallet: 1 } },
  {
    id: "daily-quest",
    title: "Daily quest",
    note: "Do the daily tasks, claim every 24 hours.",
    patch: { access: ["tasks"], totalClaims: 0, maxClaimsPerWallet: 0, cooldownHours: 24, perDayCap: 200 },
  },
  { id: "holders", title: "Holder airdrop", note: "Only wallets holding a token (or on your list) can claim.", patch: { access: ["holders"], totalClaims: 100, maxClaimsPerWallet: 1 } },
];

export function defaultForm(preset: PresetId = "group"): DropForm {
  const base: DropForm = {
    preset,
    token: ZERO_ADDRESS,
    symbol: "ETH",
    decimals: 18,
    amountPerClaim: "",
    totalClaims: 10,
    budget: "",
    maxClaimsPerWallet: 1,
    cooldownHours: 0,
    perDayCap: 0,
    unlockInHours: 0,
    expiresInDays: 30,
    access: ["link"],
    codeCount: 10,
    allowlist: "",
    holderToken: "",
    holderMin: "",
    holderDecimals: 18,
    committed: false,
    recovery: "",
    message: "",
    senderLabel: "",
  };
  return { ...base, ...(PRESETS.find((p) => p.id === preset)?.patch ?? {}) };
}

// ───────────────────────────── amounts ─────────────────────────────

/** Parse a human amount into base units (no floats). Null if invalid. */
export function toUnits(value: string, decimals: number): bigint | null {
  const v = value.trim();
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  const [whole, frac = ""] = v.split(".");
  if (frac.length > decimals) return null;
  return BigInt(whole!) * BigInt(10) ** BigInt(decimals) + BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0");
}

export function fromUnits(units: bigint, decimals: number, maxFrac = 6): string {
  const base = BigInt(10) ** BigInt(decimals);
  const whole = units / base;
  let frac = (units % base).toString().padStart(decimals, "0").slice(0, maxFrac).replace(/0+$/, "");
  if (decimals === 0) frac = "";
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function parseAddressList(text: string): `0x${string}`[] {
  const found = text.match(/0x[0-9a-fA-F]{40}/g) ?? [];
  return [...new Set(found.map((a) => a.toLowerCase()))] as `0x${string}`[];
}

// ───────────────────────────── form → contract ─────────────────────────────

export interface Prepared {
  params: {
    token: `0x${string}`;
    budget: bigint;
    amountPerClaim: bigint;
    maxAmountPerClaim: bigint;
    maxClaimsTotal: number;
    maxClaimsPerWallet: number;
    cooldown: number;
    periodSecs: number;
    maxClaimsPerPeriod: number;
    unlockAt: bigint;
    expiresAt: bigint;
    linkSigner: `0x${string}`;
    ticketSigner: `0x${string}`;
    allowlistRoot: Hex;
    codesRoot: Hex;
    gate: `0x${string}`;
    gateConfig: Hex;
    recovery: `0x${string}`;
    committed: boolean;
    message: string;
    senderLabel: string;
  };
  /** Secrets that go in share links. Never sent to our server. */
  linkKey: Hex | null;
  codeKeys: Hex[];
  allowlist: `0x${string}`[];
}

export type PrepareResult = { ok: true; prepared: Prepared } | { ok: false; error: string };

/**
 * Validate the form and build createDrop params + the secrets for the share links.
 * `appTicketSigner` is the app's signer (from /api/drops/catalog), needed for task drops.
 */
export function prepareDrop(form: DropForm, opts: { now: number; appTicketSigner: string | null; creator: string }): PrepareResult {
  const per = toUnits(form.amountPerClaim, form.decimals);
  if (!per || per <= BigInt(0)) return { ok: false, error: "Enter how much each claim gets." };

  let total = form.totalClaims;
  if (form.access.includes("codes")) total = form.codeCount;
  let budget: bigint;
  if (total > 0) {
    budget = per * BigInt(total);
  } else {
    const b = toUnits(form.budget, form.decimals);
    if (!b || b < per) return { ok: false, error: "Set a total budget of at least one claim." };
    budget = b;
  }
  if (total < 0 || total > 1_000_000) return { ok: false, error: "Claims must be between 1 and 1,000,000." };
  if (form.access.length === 0) return { ok: false, error: "Choose who can claim." };
  if (form.expiresInDays < 1 || form.expiresInDays > 3650) return { ok: false, error: "Expiry must be 1 to 3650 days." };
  if (form.message.length > 280) return { ok: false, error: "Message is too long (280 max)." };
  if (form.senderLabel.length > 40) return { ok: false, error: "Name is too long (40 max)." };

  const recovery = form.recovery.trim();
  if (recovery && !/^0x[0-9a-fA-F]{40}$/.test(recovery)) return { ok: false, error: "Recovery address isn't valid." };
  if (recovery && recovery.toLowerCase() === opts.creator.toLowerCase()) {
    return { ok: false, error: "Recovery address must be a different wallet." };
  }

  let linkKey: Hex | null = null;
  let linkSigner: `0x${string}` = ZERO_ADDRESS;
  if (form.access.includes("link")) {
    linkKey = generatePrivateKey();
    linkSigner = privateKeyToAccount(linkKey).address;
  }

  let codeKeys: Hex[] = [];
  let codesRoot = ZERO_BYTES32;
  if (form.access.includes("codes")) {
    if (form.codeCount < 1 || form.codeCount > 500) return { ok: false, error: "Make 1 to 500 codes." };
    codeKeys = Array.from({ length: form.codeCount }, () => generatePrivateKey());
    codesRoot = buildAddressTree(codeKeys.map((k) => privateKeyToAccount(k).address)).root;
  }

  let allowlist: `0x${string}`[] = [];
  let allowlistRoot = ZERO_BYTES32;
  let gate: `0x${string}` = ZERO_ADDRESS;
  let gateConfig: Hex = "0x";
  if (form.access.includes("holders") || form.access.includes("allowlist")) {
    allowlist = parseAddressList(form.allowlist);
    if (allowlist.length > 0) {
      if (allowlist.length > 10_000) return { ok: false, error: "Allowlists are capped at 10,000 addresses." };
      allowlistRoot = buildAddressTree(allowlist).root;
    }
    const holderToken = form.holderToken.trim();
    if (holderToken) {
      if (!/^0x[0-9a-fA-F]{40}$/.test(holderToken)) return { ok: false, error: "Holder token address isn't valid." };
      if (!DROPS_TOKEN_GATE) return { ok: false, error: "Token-holder checks aren't available yet." };
      const min = toUnits(form.holderMin, form.holderDecimals);
      if (!min || min <= BigInt(0)) return { ok: false, error: "Enter the minimum holding." };
      gate = DROPS_TOKEN_GATE;
      gateConfig = encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [holderToken as `0x${string}`, min]);
    }
    if (allowlist.length === 0 && gate === ZERO_ADDRESS) return { ok: false, error: "Add a holder token or paste an allowlist." };
  }

  let ticketSigner: `0x${string}` = ZERO_ADDRESS;
  if (form.access.includes("tasks")) {
    if (!opts.appTicketSigner) return { ok: false, error: "Task checks aren't available on this deployment yet." };
    ticketSigner = opts.appTicketSigner as `0x${string}`;
  }

  const unlockAt = form.unlockInHours > 0 ? BigInt(opts.now + form.unlockInHours * 3600) : BigInt(0);
  const start = form.unlockInHours > 0 ? opts.now + form.unlockInHours * 3600 : opts.now;
  const expiresAt = BigInt(start + form.expiresInDays * 86_400);

  return {
    ok: true,
    prepared: {
      params: {
        token: form.token,
        budget,
        amountPerClaim: per,
        maxAmountPerClaim: BigInt(0),
        maxClaimsTotal: total,
        maxClaimsPerWallet: form.maxClaimsPerWallet,
        cooldown: Math.round(form.cooldownHours * 3600),
        periodSecs: form.perDayCap > 0 ? 86_400 : 0,
        maxClaimsPerPeriod: form.perDayCap > 0 ? form.perDayCap : 0,
        unlockAt,
        expiresAt,
        linkSigner,
        ticketSigner,
        allowlistRoot,
        codesRoot,
        gate,
        gateConfig,
        recovery: (recovery || ZERO_ADDRESS) as `0x${string}`,
        committed: form.committed,
        message: form.message.trim(),
        senderLabel: form.senderLabel.trim(),
      },
      linkKey,
      codeKeys,
      allowlist,
    },
  };
}

// ───────────────────────────── share links ─────────────────────────────

export function dropLink(origin: string, id: bigint | string, linkKey?: Hex | null): string {
  const base = `${origin.replace(/\/$/, "")}/drops/${id}`;
  return linkKey ? `${base}#k=${linkKey.slice(2)}` : base;
}

/** A gift-card link: the code key plus its Merkle proof, all in the fragment (never sent to a server). */
export function codeLink(origin: string, id: bigint | string, codeKey: Hex, allCodeKeys: readonly Hex[]): string {
  const tree = buildAddressTree(allCodeKeys.map((k) => privateKeyToAccount(k).address));
  const proof = tree.proof(privateKeyToAccount(codeKey).address) ?? [];
  const p = proof.map((h) => h.slice(2)).join(".");
  return `${origin.replace(/\/$/, "")}/drops/${id}#c=${codeKey.slice(2)}${p ? `&p=${p}` : ""}`;
}

export interface ParsedDropLink {
  id: string | null;
  linkKey: Hex | null;
  codeKey: Hex | null;
  codeProof: Hex[];
}

export function parseDropLink(pathname: string, hash: string): ParsedDropLink {
  const m = pathname.match(/\/drops\/(\d{10,20})\/?$/);
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const hex32 = (v: string | null) => (v && /^[0-9a-fA-F]{64}$/.test(v) ? (`0x${v.toLowerCase()}` as Hex) : null);
  const proofRaw = params.get("p") ?? "";
  const codeProof = proofRaw
    ? proofRaw
        .split(".")
        .map((x) => hex32(x))
        .filter((x): x is Hex => x !== null)
    : [];
  return { id: m ? m[1]! : null, linkKey: hex32(params.get("k")), codeKey: hex32(params.get("c")), codeProof };
}

// ───────────────────────────── claim ─────────────────────────────

function ethSignedInner(tag: Hex, contract: string, id: bigint, claimer: string): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint256" }, { type: "address" }, { type: "uint256" }, { type: "address" }],
      [tag, BigInt(DROPS_CHAIN_ID), contract as `0x${string}`, id, claimer as `0x${string}`]
    )
  );
}

/** Link-key signature bound to the claimer's wallet (BaseDrops.linkDigest). */
export async function signLink(linkKey: Hex, contract: string, id: bigint, claimer: string): Promise<Hex> {
  return privateKeyToAccount(linkKey).signMessage({ message: { raw: ethSignedInner(LINK_TAG, contract, id, claimer) } });
}

/** Code-key signature bound to the claimer's wallet (BaseDrops.codeDigest). */
export async function signCode(codeKey: Hex, contract: string, id: bigint, claimer: string): Promise<Hex> {
  return privateKeyToAccount(codeKey).signMessage({ message: { raw: ethSignedInner(CODE_TAG, contract, id, claimer) } });
}

export interface ClaimArgs {
  linkSig: Hex;
  code: `0x${string}`;
  codeProof: Hex[];
  codeSig: Hex;
  allowlistProof: Hex[];
  amount: bigint;
  deadline: bigint;
  ticket: Hex;
  gateData: Hex;
  referrer: `0x${string}`;
}

export function emptyClaimArgs(): ClaimArgs {
  return {
    linkSig: "0x",
    code: ZERO_ADDRESS,
    codeProof: [],
    codeSig: "0x",
    allowlistProof: [],
    amount: BigInt(0),
    deadline: BigInt(0),
    ticket: "0x",
    gateData: "0x",
    referrer: ZERO_ADDRESS,
  };
}

/** Plain-language versions of contract revert reasons. */
export function explainDropError(message: string): string {
  const known: Array<[RegExp, string]> = [
    [/Invalid link/i, "This link isn't valid for this drop. Open the full link from the sender."],
    [/Code already used/i, "This code has already been used."],
    [/Unknown code|Invalid code signature/i, "This code isn't valid for this drop."],
    [/Not on allowlist/i, "Your wallet isn't on this drop's list."],
    [/Gate check failed/i, "Your wallet doesn't hold enough of the required token."],
    [/Invalid ticket|Ticket expired/i, "Your task check expired. Check your tasks again, then claim."],
    [/Cooldown active/i, "You claimed recently. Come back when the timer ends."],
    [/Wallet claim limit/i, "You've claimed the most this drop allows."],
    [/Period cap/i, "Today's claims are all taken. Try again tomorrow."],
    [/All claims taken|Budget exhausted/i, "Everything in this drop has been claimed."],
    [/Not unlocked/i, "This drop isn't open yet."],
    [/Drop expired/i, "This drop has expired."],
    [/Drop paused/i, "The creator paused this drop."],
    [/Drop closed/i, "This drop was closed by the creator."],
    [/Creator cannot claim/i, "You created this drop, so you can't claim it."],
    [/User rejected|denied/i, "You cancelled in your wallet."],
  ];
  for (const [re, text] of known) if (re.test(message)) return text;
  return "The transaction didn't go through. Try again.";
}
