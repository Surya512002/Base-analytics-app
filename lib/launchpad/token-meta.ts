import type { LaunchedToken, TokenSource } from "@/lib/launchpad/types";

/** B20 vanity addresses start with 0xB20 (factory + tokens). */
export function isB20TokenAddress(address: string): boolean {
  return address.toLowerCase().startsWith("0xb20");
}

export function tokenSource(token: LaunchedToken): TokenSource {
  return token.source ?? "launched";
}

export function isAppLaunched(token: LaunchedToken): boolean {
  return tokenSource(token) === "launched";
}

export function isRecentB20(token: LaunchedToken): boolean {
  return tokenSource(token) === "b20" || (isB20TokenAddress(token.address) && !isAppLaunched(token));
}

/** Any B20 vanity token in explore — factory index, app launch, or b20 source. */
export function isB20ExploreToken(token: LaunchedToken): boolean {
  return tokenSource(token) === "b20" || isB20TokenAddress(token.address);
}

export function tokenBadgeLabel(token: LaunchedToken): string | null {
  const src = tokenSource(token);
  const b20 = isB20TokenAddress(token.address);
  if (src === "launched" && b20) return "App · B20";
  if (src === "launched") return "App Launch";
  if (b20) return "B20";
  return "Base";
}

export function tokenBadgeClass(token: LaunchedToken): string {
  const src = tokenSource(token);
  if (src === "launched") {
    return "bg-[#0052FF]/20 text-[#6BA3FF] border-[#0052FF]/30";
  }
  if (isB20TokenAddress(token.address)) {
    return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
  }
  return "bg-white/10 text-slate-300 border-white/15";
}
