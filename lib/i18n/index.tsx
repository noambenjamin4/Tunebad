"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import en, { type DictKey } from "./locales/en";
import fr from "./locales/fr";
import es from "./locales/es";
import de from "./locales/de";
import pt from "./locales/pt";
import it from "./locales/it";
import ja from "./locales/ja";
import zh from "./locales/zh";

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

const DICTIONARIES: Record<LocaleCode, Record<DictKey, string>> = {
  en,
  fr,
  es,
  de,
  pt,
  it,
  ja,
  zh,
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

  useEffect(() => {
    const detected = detectLocale();
    if (detected !== "en") setLocaleState(detected);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: LocaleCode) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable — ignore persistence failure
    }
  }, []);

  const t = useCallback(
    (key: DictKey, vars?: Record<string, string | number>): string => {
      const dictionary = DICTIONARIES[locale];
      let text = dictionary[key] ?? en[key];
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
        }
      }
      return text;
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
