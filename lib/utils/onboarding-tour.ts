/** Shared keys + helpers for app / explore onboarding guides. */

export const MAIN_TOUR_KEY = "base_onboarding_done_v6";
export const MAIN_TOUR_KEY_LEGACY = "base_onboarding_done_v5";
export const EXPLORE_TOUR_KEY = "base_explore_onboarding_v1";
export const OPEN_GUIDE_EVENT = "ba-open-guide";

export type GuideKind = "main" | "explore";

export function isMainTourDone(): boolean {
  if (typeof window === "undefined") return true;
  return Boolean(
    localStorage.getItem(MAIN_TOUR_KEY) ||
      localStorage.getItem(MAIN_TOUR_KEY_LEGACY)
  );
}

export function isExploreTourDone(): boolean {
  if (typeof window === "undefined") return true;
  // Completing the main tour also suppresses the Explore rail.
  return Boolean(localStorage.getItem(EXPLORE_TOUR_KEY)) || isMainTourDone();
}

export function markMainTourDone(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MAIN_TOUR_KEY, "1");
  localStorage.setItem(MAIN_TOUR_KEY_LEGACY, "1");
  localStorage.setItem(EXPLORE_TOUR_KEY, "1");
}

export function markExploreTourDone(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(EXPLORE_TOUR_KEY, "1");
}

export function resetGuidesForReplay(which: GuideKind | "all" = "all"): void {
  if (typeof window === "undefined") return;
  if (which === "main" || which === "all") {
    localStorage.removeItem(MAIN_TOUR_KEY);
    localStorage.removeItem(MAIN_TOUR_KEY_LEGACY);
  }
  if (which === "explore" || which === "all") {
    localStorage.removeItem(EXPLORE_TOUR_KEY);
  }
}

/** Clear done flags and ask HomeApp tours to open. */
export function requestOpenGuide(which: GuideKind = "main"): void {
  if (typeof window === "undefined") return;
  resetGuidesForReplay(which === "main" ? "all" : "explore");
  window.dispatchEvent(
    new CustomEvent(OPEN_GUIDE_EVENT, { detail: { which } })
  );
}

/** Persist a replay request across navigation (e.g. Documents → home). */
export function armGuideReplay(which: GuideKind = "main"): void {
  if (typeof window === "undefined") return;
  resetGuidesForReplay(which === "main" ? "all" : "explore");
  try {
    sessionStorage.setItem("ba_guide_replay", which);
  } catch {
    /* private mode */
  }
}

export function peekGuideReplay(): GuideKind | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem("ba_guide_replay");
    if (v === "main" || v === "explore") return v;
  } catch {
    /* private mode */
  }
  return null;
}

/** Consume replay only when it matches `expected` (avoids Explore stealing a main replay). */
export function consumeGuideReplay(expected?: GuideKind): GuideKind | null {
  const v = peekGuideReplay();
  if (!v) return null;
  if (expected && v !== expected) return null;
  try {
    sessionStorage.removeItem("ba_guide_replay");
  } catch {
    /* private mode */
  }
  return v;
}

export function lockBodyScroll(locked: boolean): void {
  if (typeof document === "undefined") return;
  document.body.style.overflow = locked ? "hidden" : "";
}
