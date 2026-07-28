"use client";

import { useEffect, useState } from "react";
import type { CreatorProfile } from "@/lib/launchpad/creator-profile-types";
import { fetchCreatorProfile, fetchCreatorProfiles } from "@/lib/api/creator-client";

const cache = new Map<string, CreatorProfile | null>();
const inflight = new Map<string, Promise<CreatorProfile | null>>();

function loadProfile(address: string): Promise<CreatorProfile | null> {
  const key = address.toLowerCase();
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  const pending = inflight.get(key);
  if (pending) return pending;

  const p = fetchCreatorProfile(key).then((profile) => {
    cache.set(key, profile);
    inflight.delete(key);
    return profile;
  });
  inflight.set(key, p);
  return p;
}

export function useCreatorProfile(address: string | undefined | null) {
  const key = address?.toLowerCase() ?? "";
  const [profile, setProfile] = useState<CreatorProfile | null>(() =>
    key ? (cache.get(key) ?? null) : null
  );
  const [loading, setLoading] = useState(Boolean(key && !cache.has(key)));

  useEffect(() => {
    if (!key) {
      setProfile(null);
      setLoading(false);
      return;
    }
    if (cache.has(key)) {
      setProfile(cache.get(key) ?? null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let alive = true;
    void loadProfile(key).then((p) => {
      if (alive) {
        setProfile(p);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return { profile, loading };
}

export function patchCreatorProfileCache(profile: CreatorProfile) {
  cache.set(profile.address.toLowerCase(), profile);
}

export async function prefetchCreatorProfiles(addresses: string[]) {
  const missing = addresses
    .map((a) => a.toLowerCase())
    .filter((a) => a.startsWith("0x") && !cache.has(a));
  if (missing.length === 0) return;
  const batch = await fetchCreatorProfiles(missing);
  for (const addr of missing) {
    cache.set(addr, batch[addr] ?? null);
  }
}

export function getCachedCreatorProfile(address: string): CreatorProfile | null {
  return cache.get(address.toLowerCase()) ?? null;
}
