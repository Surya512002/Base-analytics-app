import { NextResponse } from "next/server";
import { requireSiweSession } from "@/lib/auth/siwe-session";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import { deleteCreatorCredentials } from "@/lib/voucher/credentials-store";
import { isVaultEnvelope } from "@/lib/voucher/vault-crypto";
import { MAX_VAULT_BYTES, deleteVault, readVault, writeVault } from "@/lib/voucher/vault-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const isAddress = (a: string | undefined | null): a is string => Boolean(a && /^0x[0-9a-f]{40}$/.test(a));

async function gate(req: Request, creator: string | undefined | null) {
  const ip = getClientIp(req);
  const perIp = await checkRateLimitAsync(`voucher-vault-ip:${ip}`, 60, 10 * 60_000);
  if (!perIp.ok) return rateLimitResponse(perIp.retryAfterSec);
  if (!isAddress(creator)) return NextResponse.json({ error: "Invalid creator address" }, { status: 400 });
  const session = await requireSiweSession(creator);
  if (!session.ok) {
    return NextResponse.json({ error: session.error, requiresAuth: true }, { status: session.status });
  }
  return null;
}

/** GET /api/vouchers/vault?creator=0x… → the signed-in creator's encrypted vault, or null. */
export async function GET(req: Request) {
  const creator = new URL(req.url).searchParams.get("creator")?.toLowerCase();
  const denied = await gate(req, creator);
  if (denied) return denied;
  try {
    const vault = await readVault(creator!);
    return NextResponse.json({ vault });
  } catch (err) {
    console.error("[voucher vault GET]", err);
    return NextResponse.json({ error: "Vault unavailable" }, { status: 503 });
  }
}

/**
 * PUT /api/vouchers/vault { creator, envelope, baseVersion }
 * Saves the encrypted vault if `baseVersion` is the stored version (0 for a new vault);
 * otherwise 409 with the current vault so the client can merge and retry.
 * Once a creator has a vault, their server-side copy of card secrets is deleted: the client
 * merged those into the vault before the first upload.
 */
export async function PUT(req: Request) {
  const raw = await req.text().catch(() => "");
  if (raw.length > MAX_VAULT_BYTES + 4096) {
    return NextResponse.json({ error: "Vault too large" }, { status: 413 });
  }
  let body: { creator?: string; envelope?: unknown; baseVersion?: unknown } = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const creator = body.creator?.toLowerCase();
  const denied = await gate(req, creator);
  if (denied) return denied;

  if (!isVaultEnvelope(body.envelope)) {
    return NextResponse.json({ error: "Invalid vault" }, { status: 400 });
  }
  const baseVersion = Number(body.baseVersion);
  if (!Number.isInteger(baseVersion) || baseVersion < 0) {
    return NextResponse.json({ error: "Invalid baseVersion" }, { status: 400 });
  }

  try {
    const res = await writeVault(creator!, body.envelope, baseVersion);
    if (!res.ok) return NextResponse.json({ error: "Vault changed on another device", vault: res.current }, { status: 409 });
    await deleteCreatorCredentials(creator!);
    return NextResponse.json({ vault: res.vault });
  } catch (err) {
    console.error("[voucher vault PUT]", err);
    return NextResponse.json({ error: "Vault unavailable" }, { status: 503 });
  }
}

/**
 * DELETE /api/vouchers/vault?creator=0x…
 * Removes the vault (for a creator who lost both the phrase and every unlocked device and wants
 * to start over). Gift funds are unaffected: they live onchain.
 */
export async function DELETE(req: Request) {
  const creator = new URL(req.url).searchParams.get("creator")?.toLowerCase();
  const denied = await gate(req, creator);
  if (denied) return denied;
  try {
    await deleteVault(creator!);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[voucher vault DELETE]", err);
    return NextResponse.json({ error: "Vault unavailable" }, { status: 503 });
  }
}
