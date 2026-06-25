import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";

const BUILDER_CODE = "bc_4uoh9iu2";
const RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`;

function getBuilderSuffix(): `0x${string}` {
  const cb = new TextEncoder().encode(BUILDER_CODE);
  const hex = Array.from(cb).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}${cb.length.toString(16).padStart(2, "0")}0080218021802180218021802180218021` as `0x${string}`;
}

let _scheme: ExactEvmScheme | null = null;

function getScheme(): ExactEvmScheme {
  if (_scheme) return _scheme;

  const pk = process.env.X402_FACILITATOR_PRIVATE_KEY as `0x${string}`;
  if (!pk) throw new Error("X402_FACILITATOR_PRIVATE_KEY not set");

  const account = privateKeyToAccount(pk);
  const transport = http(RPC_URL);
  const publicClient = createPublicClient({ chain: base, transport });
  const walletClient = createWalletClient({ account, chain: base, transport });

  const signer = {
    address: account.address,
    readContract: (args: Parameters<typeof publicClient.readContract>[0]) =>
      publicClient.readContract(args) as Promise<unknown>,
    verifyTypedData: (args: {
      address: `0x${string}`; domain: Record<string, unknown>;
      types: Record<string, unknown>; primaryType: string;
      message: Record<string, unknown>; signature: `0x${string}`;
    }) => publicClient.verifyTypedData(args as Parameters<typeof publicClient.verifyTypedData>[0]),
    writeContract: async (args: {
      address: `0x${string}`; abi: readonly unknown[];
      functionName: string; args: readonly unknown[];
      gas?: bigint; dataSuffix?: `0x${string}`;
    }) => walletClient.writeContract({
      ...(args as Parameters<typeof walletClient.writeContract>[0]),
      dataSuffix: getBuilderSuffix(),
    }),
    sendTransaction: (args: { to: `0x${string}`; data: `0x${string}` }) =>
      walletClient.sendTransaction(args),
    waitForTransactionReceipt: (args: { hash: `0x${string}` }) =>
      publicClient.waitForTransactionReceipt(args) as Promise<{ status: string }>,
    getCode: (args: { address: `0x${string}` }) =>
      publicClient.getCode(args),
  };

  _scheme = new ExactEvmScheme(toFacilitatorEvmSigner(signer));
  return _scheme;
}

// GET /api/x402-facilitator/supported
async function handleSupported() {
  const pk = process.env.X402_FACILITATOR_PRIVATE_KEY as `0x${string}`;
  const address = pk ? privateKeyToAccount(pk).address : "0x0000000000000000000000000000000000000000";
  return NextResponse.json({
    kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:8453" }],
    extensions: [],
    signers: { "eip155:*": [address] },
  });
}

// POST /api/x402-facilitator/verify
async function handleVerify(req: NextRequest) {
  const { paymentPayload, paymentRequirements } = await req.json();
  const result = await getScheme().verify(paymentPayload.payload, paymentRequirements);
  return NextResponse.json(result);
}

// POST /api/x402-facilitator/settle
async function handleSettle(req: NextRequest) {
  const { paymentPayload, paymentRequirements } = await req.json();
  const result = await getScheme().settle(paymentPayload.payload, paymentRequirements);
  return NextResponse.json(result);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const endpoint = path?.[0];
  if (endpoint === "supported" || !endpoint) return handleSupported();
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const endpoint = path?.[0];
  if (endpoint === "verify") return handleVerify(req);
  if (endpoint === "settle") return handleSettle(req);
  return NextResponse.json({ error: "Not found" }, { status: 404 });
} 