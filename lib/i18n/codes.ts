// The locale-code list, importable from SERVER code. lib/i18n/index.tsx is
// "use client" (React context), so anything a layout, generateMetadata, or a
// sitemap route needs must live here instead. index.tsx re-exports these so
// client call sites keep their existing import path.

export type LocaleCode = "en" | "fr" | "es" | "de" | "pt" | "it" | "ja" | "zh";

export const LOCALE_CODES: readonly LocaleCode[] = ["en", "fr", "es", "de", "pt", "it", "ja", "zh"];

export function isLocaleCode(value: string): value is LocaleCode {
  return (LOCALE_CODES as readonly string[]).includes(value);
}
