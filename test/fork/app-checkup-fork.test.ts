/**
 * Full app check-up, run AS a real wallet on real Base mainnet — in simulation only.
 * Every transaction is built with the app's own code, finalised the way the app sends it, then
 * eth_call'ed "from" the wallet. Nothing is signed, nothing is broadcast, no key is used.
 * Where the wallet lacks funds, the simulation gives it a temporary balance (state override).
 *
 *   CHECKUP_WALLET=0x… npm run test:fork   (defaults to the deployer wallet below)
 */
import { describe, expect, it } from "vitest";
import { createPublicClient, http, parseEther, parseUnits, type Address, type Hex } from "viem";
import { base } from "viem/chains";
import {
  buildAttributedNativeTransfer,
  buildContractCall,
  buildNativeTransferCall,
  encodeContractCall,
  finalizeAppTransactionBatch,
  hasBuilderSuffix,
  type ContractCall,
} from "@/lib/utils/tx";
import { encodeAerodromeBuy } from "@/lib/launchpad/aerodrome";
import { encodeExactInputSingle, encodeExactInputMultiHop } from "@/lib/launchpad/uniswap";
import { encodeSlipstreamBuy } from "@/lib/launchpad/slipstream";
import { LAUNCHPAD_TREASURY } from "@/lib/constants/launchpad";
import { splitGrossAmount } from "@/lib/launchpad/fees";
import { CAMPAIGN_ABI } from "@/lib/voucher/campaign-abi";
import { campaignLinkSigner, generateCampaignSecret } from "@/lib/voucher/campaign";
import { computeLaunchSalt, encodeCreateB20Calldata } from "@/lib/b20/encode";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";
import { B20_CREATE_GAS_LIMIT } from "@/lib/b20/preflight";

const WALLET = (process.env.CHECKUP_WALLET || "0xbCDDd1bc8F3c0c24BEDEE41720287ff50a7B7148") as Address;
const APP = process.env.CHECKUP_APP_URL || "https://base-analytics-app.vercel.app";
const RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const CAMPAIGN = "0x477919fc62b28ae4947724f7b67219d4a533a449" as Address;
const WETH = "0x4200000000000000000000000000000000000006" as Address;
const AERO = "0x940181a94a35a4569e4529a3cdfb74e38fd98631" as Address;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

const client = createPublicClient({ chain: base, transport: http(RPC, { timeout: 30_000 }) });
const results: string[] = [];

/** eth_call every call of a finalised batch from WALLET (with a temporary 1 ETH balance). */
async function simulate(label: string, calls: ContractCall[]) {
  const batch = finalizeAppTransactionBatch(calls);
  for (const [i, c] of batch.entries()) {
    // Builder code: every call the app sends must carry it (B20 factory calls are the exception,
    // covered by the companion call the batch adds).
    if (c.to.toLowerCase() !== B20_FACTORY_ADDRESS.toLowerCase()) {
      expect(hasBuilderSuffix(c.data), `${label} call #${i} has builder code`).toBe(true);
    }
    await client.call({
      account: WALLET,
      to: c.to,
      data: c.data,
      value: c.value,
      gas: c.gas,
      stateOverride: [{ address: WALLET, balance: parseEther("1") }],
    });
  }
  const attributed = batch.filter((c) => hasBuilderSuffix(c.data)).length;
  results.push(`✓ ${label}: ${batch.length} call(s) simulated OK, ${attributed} with builder code`);
}

async function getJson<T>(path: string): Promise<T> {
  // Retry network blips (ECONNRESET etc.); a real HTTP error still fails below.
  let r: Response | null = null;
  for (let attempt = 0; attempt < 3 && !r; attempt++) {
    r = await fetch(`${APP}${path}`, { cache: "no-store" }).catch(async () => {
      await new Promise((ok) => setTimeout(ok, 1500));
      return null;
    });
  }
  if (!r) throw new Error(`${path}: network unreachable after 3 tries`);
  expect(r.ok, `${path} → HTTP ${r.status}`).toBe(true);
  return (await r.json()) as T;
}

describe(`App check-up as ${WALLET} (simulation only)`, { timeout: 240_000 }, () => {
  it("Swap: buy AERO with 0.0001 ETH via the app's quoted route (+ platform fee)", async () => {
    type Quote = {
      dex: string;
      router: Address;
      amountOutMinimum: string;
      aerodromeStable?: boolean;
      aerodromeHops?: Array<{ from: string; to: string; stable: boolean }>;
      uniswapFeeTier?: number;
      uniswapPath?: Hex;
      slipstreamTickSpacing?: number;
      isLaunchedToken?: boolean;
    };
    const q = await getJson<Quote>(`/api/launchpad/quote?token=${AERO}&direction=buy&amount=0.0001&taker=${WALLET}`);
    const gross = parseEther("0.0001");
    const { net, fee } = splitGrossAmount(gross, q.isLaunchedToken ? 50 : 25);
    const minOut = BigInt(q.amountOutMinimum);
    const data =
      q.dex === "aerodrome"
        ? encodeAerodromeBuy({
            tokenOut: AERO,
            recipient: WALLET,
            amountOutMinimum: minOut,
            stable: q.aerodromeStable ?? false,
            hops: q.aerodromeHops?.map((h) => ({ from: h.from as Address, to: h.to as Address, stable: h.stable })),
          })
        : q.dex === "slipstream"
          ? encodeSlipstreamBuy({ tokenOut: AERO, recipient: WALLET, amountIn: net, amountOutMinimum: minOut, tickSpacing: q.slipstreamTickSpacing ?? 200 })
          : q.uniswapPath
            ? encodeExactInputMultiHop({ path: q.uniswapPath, recipient: WALLET, amountIn: net, amountOutMinimum: minOut })
            : encodeExactInputSingle({ tokenIn: WETH, tokenOut: AERO, recipient: WALLET, amountIn: net, amountOutMinimum: minOut, fee: q.uniswapFeeTier ?? 3000 });
    await simulate(`Swap (${q.dex})`, [buildContractCall(q.router, data, net), buildNativeTransferCall(LAUNCHPAD_TREASURY, fee)]);
  });

  it("Vouchers: create a 2-card ETH gift (server-built calls)", async () => {
    const prep = await getJson<{ valid: boolean; calls: Array<{ to: Address; data: Hex; value?: string }> }>(
      `/api/voucher/prepare-create?asset=ETH&cards=2&total=0.0002&creator=${WALLET}`
    );
    expect(prep.valid).toBe(true);
    await simulate(
      "Vouchers: personal gift",
      prep.calls.map((c) => ({ to: c.to, data: c.data, value: c.value ? BigInt(c.value) : undefined }))
    );
  });

  it("Vouchers: create a one-link ETH gift for 2 people", async () => {
    const total = parseEther("0.0002");
    const params = {
      token: ZERO,
      totalAmount: total,
      maxClaims: 2,
      linkSigner: campaignLinkSigner(generateCampaignSecret()),
      unlockAt: 0n,
      expiresAt: BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400),
      claimSigner: ZERO,
      committed: false,
      message: "checkup",
      senderLabel: "",
    };
    await simulate("Vouchers: one-link gift", [encodeContractCall(CAMPAIGN, CAMPAIGN_ABI, "createEthCampaign", [params], total)]);
  });

  it("Launch: create a B20 token (+ attribution companion)", async () => {
    const name = `Checkup${Date.now() % 100000}`;
    const data = encodeCreateB20Calldata({
      name,
      symbol: "CHK",
      creator: WALLET,
      decimals: 18,
      supplyCap: parseUnits("1000000000", 18),
      salt: computeLaunchSalt(name, "CHK", WALLET, String(Date.now())),
      adminless: true,
      mints: [{ to: WALLET, amount: parseUnits("1000000000", 18) }],
    });
    await simulate("Launch: B20 create", [{ to: B20_FACTORY_ADDRESS as Address, data, gas: B20_CREATE_GAS_LIMIT }]);
  });

  it("Profile / Pay: tip 0.0001 ETH to a creator", async () => {
    await simulate("Profile: tip", [buildAttributedNativeTransfer(LAUNCHPAD_TREASURY, parseEther("0.0001"))]);
  });

  it("Explore / Lend / Launch / Profile data load for this wallet", async () => {
    const checks: Array<[string, string, (j: Record<string, unknown>) => boolean]> = [
      ["Explore tokens", "/api/launchpad/discover", (j) => Array.isArray(j.tokens) || typeof j === "object"],
      ["Explore stocks", "/api/markets/stocks", (j) => Array.isArray(j.data) && (j.data as unknown[]).length > 0],
      ["Explore live trades", `/api/markets/trades?token=${AERO}`, (j) => Array.isArray(j.trades)],
      ["Swap holdings", `/api/wallet-holdings?address=${WALLET}`, (j) => Array.isArray(j.holdings)],
      ["Lend verified markets", "/api/markets?chainId=8453", (j) => j.ok === true && (j.markets as unknown[]).length > 0],
      ["Vouchers config", "/api/voucher/campaign/config", (j) => j.ready === true],
      ["Vouchers my one-link gifts", `/api/voucher/campaign/by-creator?address=${WALLET}`, (j) => Array.isArray(j.ids)],
      ["Launch board", "/api/launchpad/board", (j) => typeof j.stats === "object"],
      ["Profile fees", `/api/launchpad/fees?creator=${WALLET}`, (j) => typeof j.summary === "object"],
      ["Community users", "/api/app/unique-users", (j) => typeof j.count === "number" && (j.count as number) > 3],
    ];
    for (const [label, path, ok] of checks) {
      const j = await getJson<Record<string, unknown>>(path);
      expect(ok(j), label).toBe(true);
      results.push(`✓ ${label}`);
    }
    console.info(`\n[app check-up] ${WALLET}\n` + results.join("\n"));
  });
});
