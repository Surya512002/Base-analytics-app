"use client";

import React, { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n/types";

export default function LanguageSelector() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const activeMeta = SUPPORTED_LOCALES.find((l) => l.code === locale) || SUPPORTED_LOCALES[0];

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="pop-pill flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-xs font-semibold text-[var(--ink-soft)] transition cursor-pointer"
        aria-label="Select language"
        aria-expanded={open}
      >
        <Globe size={13} className="text-[var(--brand)]" />
        <span className="font-mono hidden sm:inline">{activeMeta.nativeName}</span>
        <ChevronDown size={12} className="text-[var(--ink-muted)] opacity-70 hidden sm:inline" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-44 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-popover)] shadow-xl p-1.5 z-50 animate-meridian-fade">
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)] border-b border-[var(--border-subtle)] mb-1">
            Language
          </div>
          <div className="space-y-0.5">
            {SUPPORTED_LOCALES.map((loc) => {
              const isSelected = loc.code === locale;
              return (
                <button
                  key={loc.code}
                  type="button"
                  onClick={() => {
                    setLocale(loc.code as SupportedLocale);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer ${
                    isSelected
                      ? "bg-[var(--brand-soft)] text-[var(--brand-text)] font-bold"
                      : "text-[var(--ink)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <div className="flex flex-col text-left">
                    <span>{loc.nativeName}</span>
                    <span className="text-[10px] text-[var(--ink-muted)]">{loc.label}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-[var(--brand)] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
