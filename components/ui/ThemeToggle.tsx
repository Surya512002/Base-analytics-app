"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sun, Moon, Laptop } from "lucide-react";

export type ThemeMode = "light" | "dark" | "system";

export function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
  } catch {
    // ignore localStorage errors
  }
  return "dark";
}

export function applyTheme(theme: ThemeMode) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && systemPrefersDark);

  if (isDark) {
    root.classList.add("dark");
    root.setAttribute("data-theme", "dark");
  } else {
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
  }
}

function resolvesDark(theme: ThemeMode): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

/**
 * Switch theme with a square reveal that grows from the toggle button to fill the screen
 * (View Transitions API). Falls back to an instant switch when the API is missing, when the
 * user prefers reduced motion, or when the light/dark result doesn't actually change.
 */
function switchThemeAnimated(next: ThemeMode, origin: HTMLElement | null) {
  const doc = document as ViewTransitionDoc;
  const changesLook = resolvesDark(next) !== document.documentElement.classList.contains("dark");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hidden = document.visibilityState !== "visible";
  if (!doc.startViewTransition || !origin || !changesLook || reduce || hidden) {
    applyTheme(next);
    return;
  }
  // Safety net: the browser may defer or skip the transition's callback (busy or backgrounded
  // tab). The theme must still change, so apply it directly if the callback hasn't run soon.
  let applied = false;
  const apply = () => {
    if (applied) return;
    applied = true;
    applyTheme(next);
  };
  const fallback = window.setTimeout(apply, 400);
  const r = origin.getBoundingClientRect();
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Start as the button's own square, end covering the viewport.
  const from = `inset(${r.top}px ${w - r.right}px ${h - r.bottom}px ${r.left}px round 8px)`;
  const to = "inset(0px 0px 0px 0px round 0px)";
  const transition = doc.startViewTransition(() => {
    window.clearTimeout(fallback);
    apply();
  });
  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [from, to] },
        { duration: 550, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    })
    .catch(() => undefined);
}

export default function ThemeToggle() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const current = (localStorage.getItem("theme") as ThemeMode) || "system";
      if (current === "system") {
        applyTheme("system");
      }
    };

    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  const cycleTheme = () => {
    const next: ThemeMode = theme === "system" ? "dark" : theme === "dark" ? "light" : "system";
    setTheme(next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // ignore
    }
    switchThemeAnimated(next, buttonRef.current);
  };

  if (!mounted) {
    return (
      <div className="size-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)]/60" aria-hidden />
    );
  }

  const label =
    theme === "dark"
      ? "Theme: Dark (click for Light)"
      : theme === "light"
      ? "Theme: Light (click for System)"
      : "Theme: System (click for Dark)";

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={cycleTheme}
      title={label}
      aria-label={label}
      className="inline-flex size-8 items-center justify-center overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--muted)] transition-all hover:border-[var(--brand)] hover:text-[var(--ink)] hover:shadow-sm active:scale-95"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          className="inline-flex"
          initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {theme === "dark" ? (
            <Moon className="size-4 text-blue-400" />
          ) : theme === "light" ? (
            <Sun className="size-4 text-amber-500" />
          ) : (
            <Laptop className="size-4 text-[var(--teal)]" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
