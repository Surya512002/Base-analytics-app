/** Persist last connected wallet for silent resume across route changes. */

const ADDR_KEY = "base_connected_address";

export function persistWalletAddress(address: string): void {
  if (typeof window === "undefined" || !address) return;
  localStorage.setItem(ADDR_KEY, address.toLowerCase());
}

export function readPersistedWalletAddress(): string | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(ADDR_KEY)?.toLowerCase();
  if (!v?.startsWith("0x") || v.length !== 42) return null;
  return v;
}

export function clearPersistedWalletAddress(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADDR_KEY);
}

export function isStandaloneWalletRoute(pathname?: string): boolean {
  const path =
    pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  return (
    path.startsWith("/creator") ||
    path.startsWith("/profile") ||
    path.startsWith("/wallet/") ||
    path.startsWith("/docs") ||
    path.startsWith("/help")
  );
}

/** Map app tabs to real routes when leaving standalone pages. */
export function hrefForAppTab(tab: string): string {
  switch (tab) {
    case "launchpad":
      return "/explore";
    case "swap":
      return "/swap";
    case "dashboard":
      return "/?tab=dashboard";
    case "checkin":
    case "rewards":
      return "/?tab=checkin";
    case "achievements":
      return "/?tab=achievements";
    case "basehub":
      return "/?tab=basehub";
    case "leaderboard":
      return "/?tab=checkin";
    case "profile":
      return "/profile";
    default:
      return "/explore";
  }
}
