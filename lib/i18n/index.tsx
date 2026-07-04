"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import en, { type DictKey } from "./locales/en";

export type LocaleCode = "en" | "fr" | "es" | "de" | "pt" | "it" | "ja" | "zh";

export const LOCALES: { code: LocaleCode; name: string }[] = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "de", name: "Deutsch" },
  { code: "pt", name: "Português" },
  { code: "it", name: "Italiano" },
  { code: "ja", name: "日本語" },
  { code: "zh", name: "中文" },
];

type Dict = Record<DictKey, string>;

// `en` ships statically (SSR default + universal fallback). The other 7
// locales are code-split: each loader is an explicit thunk (rather than a
// template-literal `import(\`./locales/${code}\`)`) since that form is
// guaranteed to let webpack statically analyze and split each import —
// template-literal dynamic imports over a directory are supported too, but
// an explicit map is the safer, always-working choice.
const LOCALE_LOADERS: Record<Exclude<LocaleCode, "en">, () => Promise<{ default: Dict }>> = {
  fr: () => import("./locales/fr"),
  es: () => import("./locales/es"),
  de: () => import("./locales/de"),
  pt: () => import("./locales/pt"),
  it: () => import("./locales/it"),
  ja: () => import("./locales/ja"),
  zh: () => import("./locales/zh"),
};

const STORAGE_KEY = "tuner-locale";

function isLocaleCode(value: string): value is LocaleCode {
  return LOCALES.some((locale) => locale.code === value);
}

function detectLocale(): LocaleCode {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && isLocaleCode(stored)) return stored;
  } catch {
    // localStorage unavailable (e.g. private mode) — fall through to navigator detection
  }
  const navigatorLanguage = window.navigator?.language?.slice(0, 2).toLowerCase();
  if (navigatorLanguage && isLocaleCode(navigatorLanguage)) return navigatorLanguage;
  return "en";
}

interface I18nContextValue {
  locale: LocaleCode;
  setLocale(locale: LocaleCode): void;
  t(key: DictKey, vars?: Record<string, string | number>): string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Initial render (SSR + first client render) must stay "en" to avoid a
  // hydration mismatch; the detected locale is applied after mount.
  const [locale, setLocaleState] = useState<LocaleCode>("en");

  // Non-en dictionaries are fetched on demand and cached here once loaded.
  // `t()` stays synchronous: it reads whatever is already in this map and
  // falls back to `en` if the requested locale hasn't finished loading yet.
  const [loadedDicts, setLoadedDicts] = useState<Partial<Record<LocaleCode, Dict>>>({});
  const loadingRef = useRef<Partial<Record<LocaleCode, Promise<void>>>>({});

  const ensureLoaded = useCallback((code: LocaleCode) => {
    if (code === "en") return;
    if (loadedDicts[code] || loadingRef.current[code]) return;
    loadingRef.current[code] = LOCALE_LOADERS[code]()
      .then((mod) => {
        setLoadedDicts((current) => ({ ...current, [code]: mod.default }));
      })
      .catch(() => {
        // Load failure (e.g. offline) — `t()` keeps falling back to `en`.
        delete loadingRef.current[code];
      });
  }, [loadedDicts]);

  useEffect(() => {
    const detected = detectLocale();
    if (detected !== "en") {
      ensureLoaded(detected);
      setLocaleState(detected);
    }
    // Runs once on mount to auto-detect; ensureLoaded is stable enough in
    // practice (it only changes identity when loadedDicts grows).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    (next: LocaleCode) => {
      ensureLoaded(next);
      setLocaleState(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage unavailable — ignore persistence failure
      }
    },
    [ensureLoaded],
  );

  const t = useCallback(
    (key: DictKey, vars?: Record<string, string | number>): string => {
      const dictionary = locale === "en" ? en : loadedDicts[locale] ?? en;
      let text = dictionary[key] ?? en[key];
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
        }
      }
      return text;
    },
    [locale, loadedDicts],
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
