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

export function captureGuestResumeFromUrl(): GuestResumeContext {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return {
    tab: p.get("tab") ?? undefined,
    token: p.get("token") ?? undefined,
    card: p.get("card") ?? localStorage.getItem("base_redeem_card") ?? undefined,
    challenge: p.get("challenge") ?? undefined,
    returnPath: window.location.pathname + window.location.search,
  };
}
