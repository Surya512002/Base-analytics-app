/**
 * Drops readiness check (server only): is this deployment fully set up to run Drops?
 * Returns plain pass/fail per item, never secret values. Used by /api/drops/status and the
 * mainnet preflight (scripts/drops-preflight.mjs).
 */
import { dropsKv } from "./kv";
import { DROPS_CHAIN_ID, createDropsPublicClient } from "./network";
import { dropsContract, ticketSigner } from "./chain";
import { sealJson } from "@/lib/voucher/secret-box";

export interface StatusCheck {
  id: string;
  ok: boolean;
  note: string;
}

const addr = (v: string | undefined) => (/^0x[0-9a-fA-F]{40}$/.test((v ?? "").trim()) ? ((v ?? "").trim() as `0x${string}`) : null);

async function hasCode(address: `0x${string}`): Promise<boolean> {
  try {
    const code = await createDropsPublicClient().getCode({ address });
    return Boolean(code && code !== "0x");
  } catch {
    return false;
  }
}

export async function dropsStatus(): Promise<{ ready: boolean; chainId: number; checks: StatusCheck[] }> {
  const checks: StatusCheck[] = [];
  const add = (id: string, ok: boolean, note: string) => checks.push({ id, ok, note: ok ? "ok" : note });

  const contract = dropsContract();
  add("contract", Boolean(contract) && (await hasCode(contract!)), "NEXT_PUBLIC_DROPS_CONTRACT is missing or has no code on this chain.");

  const gate = addr(process.env.NEXT_PUBLIC_DROPS_TOKEN_GATE);
  add("token_gate", Boolean(gate) && (await hasCode(gate!)), "NEXT_PUBLIC_DROPS_TOKEN_GATE is missing or has no code (token-holder drops stay off).");

  add("deploy_block", Number(process.env.NEXT_PUBLIC_DROPS_DEPLOY_BLOCK) > 0, "NEXT_PUBLIC_DROPS_DEPLOY_BLOCK is missing (My drops only shows this browser's drops).");
  add("ticket_signer", Boolean(ticketSigner()), "DROPS_TICKET_SIGNER_KEY is missing or not a 32-byte key (task, lucky and split drops can't be claimed).");
  add("login_secret", Boolean(process.env.SIWE_SESSION_SECRET?.trim()), "SIWE_SESSION_SECRET is missing.");
  add("secrets_key", Boolean(sealJson({ ok: 1 }, "drops-status")), "VOUCHER_SECRETS_KEY is missing (webhook secrets and raffle seeds can't be stored safely).");

  let storage = false;
  try {
    const key = `drops:status:${Date.now()}`;
    await dropsKv.set(key, "1", 30);
    storage = (await dropsKv.get(key)) === "1";
    await dropsKv.del(key);
  } catch {
    storage = false;
  }
  add("storage", storage, "Redis isn't reachable (KV_REDIS_URL), so drop rules, progress and shares can't be saved.");

  add("app_url", Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()), "NEXT_PUBLIC_APP_URL is missing (share links and sign-in use it).");
  return { ready: checks.every((c) => c.ok), chainId: DROPS_CHAIN_ID, checks };
}
