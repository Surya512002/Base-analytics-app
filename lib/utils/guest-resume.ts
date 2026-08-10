const KEY = "base_guest_resume_v1";

export type GuestResumeContext = {
  tab?: string;
  token?: string;
  card?: string;
  challenge?: string;
  redeemSecret?: string;
  returnPath?: string;
};

export function saveGuestResume(ctx: GuestResumeContext) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(ctx));
}

export function readGuestResume(): GuestResumeContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GuestResumeContext) : null;
  } catch {
    return null;
  }
}

export function clearGuestResume() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}

function parseTokenFromPath(pathname: string): { tab?: string; token?: string } {
  const swap = pathname.match(/^\/swap\/token\/(0x[a-fA-F0-9]{40})\/?$/i);
  if (swap?.[1]) return { tab: "swap", token: swap[1].toLowerCase() };
  const explore = pathname.match(/^\/explore\/token\/(0x[a-fA-F0-9]{40})\/?$/i);
  if (explore?.[1]) return { tab: "launchpad", token: explore[1].toLowerCase() };
  if (pathname === "/swap" || pathname.startsWith("/swap/")) return { tab: "swap" };
  if (pathname === "/explore" || pathname.startsWith("/explore/")) return { tab: "launchpad" };
  return {};
}

export function captureGuestResumeFromUrl(): GuestResumeContext {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const fromPath = parseTokenFromPath(window.location.pathname);
  const qsToken = p.get("token")?.trim().toLowerCase();
  const token =
    (qsToken?.startsWith("0x") && qsToken.length === 42 ? qsToken : undefined) ??
    fromPath.token;
  const tab = p.get("tab") ?? fromPath.tab;
  return {
    tab,
    token,
    card: p.get("card") ?? localStorage.getItem("base_redeem_card") ?? undefined,
    challenge: p.get("challenge") ?? undefined,
    returnPath: window.location.pathname + window.location.search,
  };
}
