import { cacheGet, cacheSet } from "@/lib/redis-cache";
import type { PriceAlertInput, StoredPriceAlert } from "@/lib/price-alerts/types";

const REGISTRY_KEY = "price-alerts:v1";
const REGISTRY_TTL = 60 * 60 * 24 * 90;
const MAX_ALERTS = 500;

const memAlerts: StoredPriceAlert[] = [];

function normalizeWallet(wallet: string): string {
  return wallet.trim().toLowerCase();
}

function normalizeToken(address: string): string {
  return address.trim().toLowerCase();
}

function alertId(wallet: string, token: string): string {
  return `${normalizeWallet(wallet)}:${normalizeToken(token)}`;
}

async function readAll(): Promise<StoredPriceAlert[]> {
  const cached = await cacheGet<StoredPriceAlert[]>(REGISTRY_KEY);
  if (cached?.length) return cached;
  return memAlerts;
}

async function writeAll(alerts: StoredPriceAlert[]): Promise<void> {
  memAlerts.length = 0;
  memAlerts.push(...alerts);
  await cacheSet(REGISTRY_KEY, alerts, REGISTRY_TTL).catch(() => {});
}

export async function listPriceAlerts(wallet?: string): Promise<StoredPriceAlert[]> {
  const all = await readAll();
  if (!wallet) return all.filter((a) => !a.triggered);
  const w = normalizeWallet(wallet);
  return all.filter((a) => a.wallet === w && !a.triggered);
}

export async function listActivePriceAlerts(): Promise<StoredPriceAlert[]> {
  const all = await readAll();
  return all.filter((a) => !a.triggered);
}

export async function upsertPriceAlert(input: PriceAlertInput): Promise<StoredPriceAlert> {
  const wallet = normalizeWallet(input.wallet);
  const address = normalizeToken(input.address);
  const entry: StoredPriceAlert = {
    id: alertId(wallet, address),
    wallet,
    address,
    symbol: input.symbol,
    direction: input.direction,
    priceUsd: input.priceUsd,
    createdAt: Date.now(),
    triggered: false,
  };

  const all = await readAll();
  const filtered = all.filter((a) => a.id !== entry.id);
  const next = [entry, ...filtered].slice(0, MAX_ALERTS);
  await writeAll(next);
  return entry;
}

export async function removePriceAlert(wallet: string, token: string): Promise<void> {
  const id = alertId(wallet, token);
  const all = await readAll();
  await writeAll(all.filter((a) => a.id !== id));
}

export async function markPriceAlertTriggered(id: string): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx]!, triggered: true };
  await writeAll(all);
}
