// The single source of truth for WHICH routes have localized variants.
//
// Everything keys off this list: the (intl)/[locale] pages that exist, the
// `languages:` alternates both sides of a cluster emit, the sitemap's
// localized entries, and the nav helper that keeps localized pages
// interlinking in-locale. One list, so a route cannot be half-localized
// (page exists but no hreflang, or hreflang pointing at a 404).
//
// English stays at the ROOT — /mp3-cutter, not /en/mp3-cutter — so the
// existing link graph and GSC standing never move. The 7 other locales live
// at /<locale><path>. Google treats language-only hreflang codes ("fr") as
// valid, and per its docs hreflang may be supplied by page-level <link>
// tags alone; the sitemap only needs the URLs for discovery.

import { LOCALE_CODES, type LocaleCode } from "@/lib/i18n/codes";

/** Routes with localized variants. Grows in phase C4; keep alphabetical. */
export const LOCALIZED_PATHS: readonly string[] = [
  "/converter",
  "/daw",
  "/key-bpm-finder",
  "/mp3-cutter",
  "/slowed-reverb",
];

export function isLocalizedPath(path: string): boolean {
  return LOCALIZED_PATHS.includes(path);
}

export function localizedHref(path: string, locale: LocaleCode): string {
  return locale === "en" ? path : `/${locale}${path}`;
}

/**
 * The full alternates cluster for one path, for `alternates.languages`.
 * Every member of a cluster must list ALL members including itself
 * (Google's bidirectional-confirmation rule), so both the EN page and each
 * localized page emit exactly this map. x-default points at the English
 * root — the page a user with no matching language should get.
 */
export function languageAlternates(path: string): Record<string, string> {
  const map: Record<string, string> = { "x-default": path };
  for (const code of LOCALE_CODES) map[code] = localizedHref(path, code);
  return map;
}
