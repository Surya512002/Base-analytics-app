import { formatEther, parseEther, type Hex } from "viem";
import { isB20AssetActivated } from "@/lib/b20/activation";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";
import {
  createPublicOnlyBaseClient,
  isRpcInfrastructureError,
} from "@/lib/utils/base-rpc";

/** Rabby / public RPC often cannot estimate B20 precompile gas — set explicitly. */
export const B20_CREATE_GAS_LIMIT = BigInt(1_200_000);
export const B20_MINT_GAS_LIMIT = BigInt(200_000);

/** Minimum ETH reserved for B20 factory gas (create + optional seed tx). */
export const MIN_LAUNCH_GAS_ETH = parseEther("0.00003");

export function gasLimitForB20Target(to: string): bigint {
  return to.toLowerCase() === B20_FACTORY_ADDRESS.toLowerCase()
    ? B20_CREATE_GAS_LIMIT
    : B20_MINT_GAS_LIMIT;
}

/** True only for genuine contract execution reverts (not RPC/network failures). */
function isExecutionRevert(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("revert") ||
    m.includes("execution reverted") ||
    m.includes("tokenalreadyexists") ||
    m.includes("featurenotactivated") ||
    m.includes("invaliddecimals") ||
    m.includes("supplycap") ||
    m.includes("initcallfailed") ||
    m.includes("abidecodefailed") ||
    m.includes("missingrequiredfield")
  );
}

/**
 * Dry-run createB20 before opening the wallet — surfaces revert reasons early.
 * Only blocks the launch on a genuine execution revert; RPC/rate-limit/timeout
 * failures return ok so the user can still submit (wallet re-simulates anyway).
 */
export async function simulateB20Create(
  creator: `0x${string}`,
  data: Hex
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const pub = createPublicOnlyBaseClient();
  try {
    await pub.call({
      account: creator,
      to: B20_FACTORY_ADDRESS,
      data,
      gas: B20_CREATE_GAS_LIMIT,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    // RPC capped / rate-limited / network hiccup — can't determine, don't block.
    if (isRpcInfrastructureError(e) || !isExecutionRevert(msg)) {
      console.warn("[b20] simulate skipped (non-revert RPC error)", msg);
      return { ok: true };
    }

    if (msg.includes("TokenAlreadyExists")) {
      return { ok: false, reason: "Token already exists at this address — grind a new vanity salt" };
    }
    if (msg.includes("FeatureNotActivated")) {
      return { ok: false, reason: "B20 is not activated on Base mainnet yet" };
    }
    if (msg.includes("InvalidDecimals")) {
      return { ok: false, reason: "Invalid token decimals (must be 6–18)" };
    }
    if (msg.includes("SupplyCapExceeded") || msg.includes("InvalidSupplyCap")) {
      return { ok: false, reason: "Invalid supply cap or mint allocations" };
    }
    if (msg.includes("AbiDecodeFailed")) {
      return { ok: false, reason: "Invalid launch parameters — refresh and try again" };
    }
    return {
      ok: false,
      reason: "Launch simulation failed — check allocations and try a new salt",
    };
  }
}

export async function preflightB20Launch(
  address: `0x${string}`,
  opts?: { seedEthWei?: bigint }
): Promise<{
  activated: boolean;
  balanceEth: string;
  hasMinGas: boolean;
  minEth: string;
}> {
  const seedWei = opts?.seedEthWei ?? BigInt(0);
  const minRequired = MIN_LAUNCH_GAS_ETH + seedWei;
  let balanceEth = "0";
  let hasMinGas = true;
  try {
    const pub = createPublicOnlyBaseClient();
    const balance = await pub.getBalance({ address });
    balanceEth = formatEther(balance);
    hasMinGas = balance >= minRequired;
  } catch (e) {
    console.warn("[b20/preflight] balance check skipped (RPC error)", e);
    // Don't block launch when RPC is flaky — wallet will reject if insufficient funds.
  }

  const activated = await isB20AssetActivated();

  return {
    activated,
    balanceEth,
    hasMinGas,
    minEth: formatEther(minRequired),
  };
}
