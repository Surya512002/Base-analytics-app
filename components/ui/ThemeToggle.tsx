"use client";

import { useEffect, useState } from "react";
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

export default function ThemeToggle() {
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
    applyTheme(next);
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
      type="button"
      onClick={cycleTheme}
      title={label}
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--muted)] transition-all hover:border-[var(--brand)] hover:text-[var(--ink)] hover:shadow-sm active:scale-95"
    >
      {theme === "dark" ? (
        <Moon className="size-4 text-blue-400 transition-transform rotate-0" />
      ) : theme === "light" ? (
        <Sun className="size-4 text-amber-500 transition-transform rotate-0" />
      ) : (
        <Laptop className="size-4 text-[var(--teal)] transition-transform" />
      )}
    </button>
  );
}
