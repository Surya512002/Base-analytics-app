/**
 * BaseDrops onchain reads and the app's ticket signer (server only).
 *
 * Env:
 *  - NEXT_PUBLIC_DROPS_CONTRACT   BaseDrops address (unset until deployed → APIs answer 503)
 *  - DROPS_TICKET_SIGNER_KEY      private key whose address creators put as a drop's ticketSigner.
 *                                 Separate from CAMPAIGN_CLAIM_SIGNER_KEY so either can rotate alone.
 */
import { encodeAbiParameters, keccak256, stringToBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { BASE_DROPS_ABI } from "./abi";
import { DROPS_CHAIN_ID } from "./network";

/** Chain Drops runs on (8453, or 84532 when NEXT_PUBLIC_DROPS_CHAIN_ID=84532). */
export const BASE_CHAIN_ID: number = DROPS_CHAIN_ID;
export const FIRST_DROP_ID = BigInt(2_000_000_001);
export const TICKET_TTL_SEC = 10 * 60;
export const TICKET_TAG = keccak256(stringToBytes("BaseDrops.v1.ticket"));

export function dropsContract(): `0x${string}` | null {
  const raw = (process.env.NEXT_PUBLIC_DROPS_CONTRACT || "").trim();
  return /^0x[0-9a-fA-F]{40}$/.test(raw) ? (raw as `0x${string}`) : null;
}

export function ticketSigner() {
  const raw = (process.env.DROPS_TICKET_SIGNER_KEY || "").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) return null;
  return privateKeyToAccount(raw as Hex);
}

/** Inner hash the contract wraps in EIP-191 (must match BaseDrops.ticketDigest). */
export function ticketInnerHash(a: {
  chainId: number;
  contract: `0x${string}`;
  dropId: bigint;
  claimer: `0x${string}`;
  claimIndex: number;
  amount: bigint;
  deadline: bigint;
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint32" },
        { type: "uint256" },
        { type: "uint64" },
      ],
      [TICKET_TAG, BigInt(a.chainId), a.contract, a.dropId, a.claimer, a.claimIndex, a.amount, a.deadline]
    )
  );
}

export async function signTicket(a: Parameters<typeof ticketInnerHash>[0]): Promise<Hex | null> {
  const signer = ticketSigner();
  if (!signer) return null;
  return signer.signMessage({ message: { raw: ticketInnerHash(a) } });
}

export interface OnchainDrop {
  creator: `0x${string}`;
  token: `0x${string}`;
  amountPerClaim: bigint;
  maxAmountPerClaim: bigint;
  budget: bigint;
  createdAt: number;
  unlockAt: number;
  expiresAt: number;
  ticketSigner: `0x${string}`;
  allowlistRoot: `0x${string}`;
  committed: boolean;
  paused: boolean;
  closed: boolean;
}

type Reader = {
  readContract(args: { address: `0x${string}`; abi: typeof BASE_DROPS_ABI; functionName: string; args: readonly unknown[] }): Promise<unknown>;
};

export async function readDrop(client: Reader, contract: `0x${string}`, id: bigint): Promise<OnchainDrop | null> {
  const res = (await client.readContract({ address: contract, abi: BASE_DROPS_ABI, functionName: "getDrop", args: [id] })) as [
    Record<string, unknown>,
    string,
    string,
  ];
  const d = res[0];
  const creator = String(d.creator) as `0x${string}`;
  if (/^0x0{40}$/i.test(creator)) return null;
  return {
    creator,
    token: d.token as `0x${string}`,
    amountPerClaim: BigInt(d.amountPerClaim as bigint),
    maxAmountPerClaim: BigInt(d.maxAmountPerClaim as bigint),
    budget: BigInt(d.budget as bigint),
    createdAt: Number(d.createdAt),
    unlockAt: Number(d.unlockAt),
    expiresAt: Number(d.expiresAt),
    ticketSigner: d.ticketSigner as `0x${string}`,
    allowlistRoot: String(d.allowlistRoot) as `0x${string}`,
    committed: Boolean(d.committed),
    paused: Boolean(d.paused),
    closed: Boolean(d.closed),
  };
}

/** The wallet's claims so far (the ticket's claimIndex) and why it can't claim right now ("" = it can). */
export async function readWallet(
  client: Reader,
  contract: `0x${string}`,
  id: bigint,
  wallet: `0x${string}`
): Promise<{ claimIndex: number; blocker: string }> {
  const [state, blocker] = await Promise.all([
    client.readContract({ address: contract, abi: BASE_DROPS_ABI, functionName: "walletState", args: [id, wallet] }),
    client.readContract({ address: contract, abi: BASE_DROPS_ABI, functionName: "claimBlocker", args: [id, wallet] }),
  ]);
  const claims = Array.isArray(state) ? Number(state[0]) : Number((state as { claims: number }).claims);
  return { claimIndex: claims, blocker: String(blocker) };
}
