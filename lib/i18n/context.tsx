"use client";

import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { SupportedLocale, TranslationDictionary } from "./types";
import { TRANSLATIONS } from "./translations";

interface I18nContextType {
  locale: SupportedLocale;
  setLocale: (loc: SupportedLocale) => void;
  t: TranslationDictionary;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: TRANSLATIONS.en,
});

const LOCALE_STORAGE_KEY = "base_terminal_locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as SupportedLocale | null;
      if (saved && TRANSLATIONS[saved]) {
        setLocaleState(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setLocale = (loc: SupportedLocale) => {
    setLocaleState(loc);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, loc);
      document.documentElement.lang = loc;
    } catch {
      /* ignore */
    }
  };

  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
