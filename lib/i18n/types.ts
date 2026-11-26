export type SupportedLocale = "en" | "hi" | "ta" | "es" | "pt" | "id";

export interface LocaleMeta {
  code: SupportedLocale;
  label: string;
  nativeName: string;
  dir: "ltr" | "rtl";
}

export const SUPPORTED_LOCALES: LocaleMeta[] = [
  { code: "en", label: "English", nativeName: "English", dir: "ltr" },
  { code: "hi", label: "Hindi", nativeName: "हिन्दी", dir: "ltr" },
  { code: "ta", label: "Tamil", nativeName: "தமிழ்", dir: "ltr" },
  { code: "es", label: "Spanish", nativeName: "Español", dir: "ltr" },
  { code: "pt", label: "Portuguese", nativeName: "Português", dir: "ltr" },
  { code: "id", label: "Indonesian", nativeName: "Bahasa Indonesia", dir: "ltr" },
];

export interface TranslationDictionary {
  /** One label per menu place (see lib/nav/directory.ts). */
  nav: {
    home: string;
    swap: string;
    markets: string;
    trade: string;
    earn: string;
    gifts: string;
    launch: string;
    account: string;
  };
  actions: {
    connectWallet: string;
    disconnect: string;
    supply: string;
    borrow: string;
    stake: string;
    exploreVault: string;
    executeSwap: string;
    createVoucher: string;
    claim: string;
  };
  status: {
    loading: string;
    unavailable: string;
    confirmed: string;
    pending: string;
    failed: string;
    verified: string;
  };
}
