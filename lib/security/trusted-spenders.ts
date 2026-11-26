import { CAMPAIGN_CONTRACT, VOUCHER_CONTRACT } from "@/lib/constants/env";
import { CAMPAIGN_CONTRACT_LEGACY } from "@/lib/voucher/campaign-contracts";
import { SWAP_ROUTER_02 } from "@/lib/launchpad/uniswap";
import { AERODROME_ROUTER } from "@/lib/launchpad/aerodrome";
import { SLIPSTREAM_SWAP_ROUTER, SLIPSTREAM_V2_ROUTER } from "@/lib/launchpad/slipstream";
import { UNISWAP_NPM } from "@/lib/launchpad/uniswap-seed";
import { ZEROX_ALLOWANCE_HOLDER, type ContractCall } from "@/lib/utils/tx";
import { MORPHO_BLUE_BASE, AAVE_V3_POOL_BASE } from "@/lib/lending/constants";
import { BASE_LENDING_MARKETS } from "@/lib/lending/markets";
import { BEEFY_TOKEN_MANAGER, BEEFY_ZAP_ROUTER } from "@/lib/lending/zap/zap-router";
import { AAVE_V4_SPOKE } from "@/lib/lending/aave-v4/constants";
import REVIEWED_LENDING from "@/lib/security/reviewed-lending-contracts.json";

/**
 * Every contract the app may ask a wallet to approve. A token approval is the one thing that
 * lets a contract take funds out of a wallet later, so an approval to anything else is refused
 * before the wallet is even asked. Addresses that arrive at runtime (aggregator quotes, vaults
 * found through third-party APIs) can only be used if they are on this list.
 *
 * To add a vault or router: check it on BaseScan, then add it here or to
 * reviewed-lending-contracts.json (a snapshot of the live lending markets, each checked to hold
 * code on Base on 2026-11-22).
 */
const env = (v: string | undefined) => (v && /^0x[0-9a-fA-F]{40}$/.test(v.trim()) ? v.trim() : "");

const FIXED: string[] = [
  // swaps and liquidity
  SWAP_ROUTER_02,
  AERODROME_ROUTER,
  SLIPSTREAM_SWAP_ROUTER,
  SLIPSTREAM_V2_ROUTER,
  ZEROX_ALLOWANCE_HOLDER,
  UNISWAP_NPM,
  // gifts, campaigns, drops, orders (our own contracts)
  VOUCHER_CONTRACT,
  CAMPAIGN_CONTRACT,
  CAMPAIGN_CONTRACT_LEGACY,
  env(process.env.NEXT_PUBLIC_DROPS_CONTRACT),
  env(process.env.NEXT_PUBLIC_LIMIT_ORDER_BOOK_MAINNET),
  // lending
  MORPHO_BLUE_BASE,
  AAVE_V3_POOL_BASE,
  AAVE_V4_SPOKE,
  BEEFY_ZAP_ROUTER,
  BEEFY_TOKEN_MANAGER,
  ...BASE_LENDING_MARKETS.map((m) => m.contractAddress),
];

const TRUSTED = new Set(
  [...FIXED, ...Object.keys(REVIEWED_LENDING)].filter(Boolean).map((a) => a.toLowerCase())
);

/** Core lending protocols where an "unlimited" approval is allowed if the user asks for it. */
const UNLIMITED_OK = new Set(
  [MORPHO_BLUE_BASE, AAVE_V3_POOL_BASE, ...BASE_LENDING_MARKETS.filter((m) => m.protocol !== "beefy").map((m) => m.contractAddress)].map(
    (a) => a.toLowerCase()
  )
);

export function isTrustedSpender(address: string | null | undefined): boolean {
  return Boolean(address && TRUSTED.has(address.toLowerCase()));
}

export function isUnlimitedApprovalAllowed(address: string | null | undefined): boolean {
  return Boolean(address && UNLIMITED_OK.has(address.toLowerCase()));
}

// approve(address,uint256), increaseAllowance(address,uint256), setApprovalForAll(address,bool)
const APPROVE = "0x095ea7b3";
const INCREASE_ALLOWANCE = "0x39509351";
const SET_APPROVAL_FOR_ALL = "0xa22cb465";
const UNLIMITED_FROM = BigInt(1) << BigInt(255);

/** Throws before anything reaches the wallet if a call would approve an unknown contract. */
export function assertTrustedApprovals(calls: readonly Pick<ContractCall, "to" | "data">[]): void {
  for (const call of calls) {
    const data = (call.data ?? "").toLowerCase();
    const selector = data.slice(0, 10);
    if (selector !== APPROVE && selector !== INCREASE_ALLOWANCE && selector !== SET_APPROVAL_FOR_ALL) continue;
    if (data.length < 138) throw new Error("Blocked: malformed approval");
    const spender = `0x${data.slice(34, 74)}`;
    if (!isTrustedSpender(spender)) {
      throw new Error(`Blocked for your safety: approval to an unrecognised contract (${spender})`);
    }
    if (selector === SET_APPROVAL_FOR_ALL) {
      throw new Error("Blocked for your safety: approval of all your NFTs is never needed here");
    }
    const amount = BigInt(`0x${data.slice(74, 138)}`);
    if (amount >= UNLIMITED_FROM && !isUnlimitedApprovalAllowed(spender)) {
      throw new Error("Blocked for your safety: unlimited approval is only allowed for core lending protocols");
    }
  }
}
