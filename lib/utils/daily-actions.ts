import { todayUtcKey } from "@/lib/utils/check-in-status";

function addrKey(address: string): string {
  return address.toLowerCase();
}

export function boostTimestampKey(address: string): string {
  return `base_boost_ts_${addrKey(address)}`;
}

export function gmTimestampKey(address: string): string {
  return `base_gm_ts_${addrKey(address)}`;
}

export function gnTimestampKey(address: string): string {
  return `base_gn_ts_${addrKey(address)}`;
}

export function readLocalBoostTime(address: string): number | null {
  if (typeof window === "undefined" || !address) return null;
  const raw = localStorage.getItem(boostTimestampKey(address));
  if (!raw) return null;
  const num = parseInt(raw, 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function writeLocalBoostTime(address: string, timestampSec?: number): void {
  if (typeof window === "undefined" || !address) return;
  const ts = timestampSec ?? Math.floor(Date.now() / 1000);
  localStorage.setItem(boostTimestampKey(address), String(ts));
}

export function isBoostedToday(address: string): boolean {
  const ts = readLocalBoostTime(address);
  if (!ts) return false;
  return new Date(ts * 1000).toISOString().slice(0, 10) === todayUtcKey();
}

export function readLocalGmTime(address: string): number | null {
  if (typeof window === "undefined" || !address) return null;
  const raw = localStorage.getItem(gmTimestampKey(address));
  if (!raw) return null;
  const num = parseInt(raw, 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function writeLocalGmTime(address: string, timestampSec?: number): void {
  if (typeof window === "undefined" || !address) return;
  const ts = timestampSec ?? Math.floor(Date.now() / 1000);
  localStorage.setItem(gmTimestampKey(address), String(ts));
}

export function isGmSentToday(address: string): boolean {
  const ts = readLocalGmTime(address);
  if (!ts) return false;
  return new Date(ts * 1000).toISOString().slice(0, 10) === todayUtcKey();
}

export function readLocalGnTime(address: string): number | null {
  if (typeof window === "undefined" || !address) return null;
  const raw = localStorage.getItem(gnTimestampKey(address));
  if (!raw) return null;
  const num = parseInt(raw, 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function writeLocalGnTime(address: string, timestampSec?: number): void {
  if (typeof window === "undefined" || !address) return;
  const ts = timestampSec ?? Math.floor(Date.now() / 1000);
  localStorage.setItem(gnTimestampKey(address), String(ts));
}

export function isGnSentToday(address: string): boolean {
  const ts = readLocalGnTime(address);
  if (!ts) return false;
  return new Date(ts * 1000).toISOString().slice(0, 10) === todayUtcKey();
}

export function formatActionRelativeTime(timestampSec: number | null | undefined): string {
  if (!timestampSec || timestampSec <= 0) return "Never";
  const nowSec = Math.floor(Date.now() / 1000);
  const diff = nowSec - timestampSec;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

  const date = new Date(timestampSec * 1000);
  const now = new Date();
  const isThisYear = date.getFullYear() === now.getFullYear();

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: isThisYear ? undefined : "numeric",
  });
}
