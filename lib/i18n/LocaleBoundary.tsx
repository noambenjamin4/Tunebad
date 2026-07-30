"use client";

// The bridge between a localized ROUTE and the client i18n context.
//
// On root routes the locale is a client-side preference (localStorage,
// applied after mount, SSR always English). On /fr/... routes the locale is
// a fact of the URL and must hold from the very first server-rendered byte.
// The [locale] layout mounts this provider with the locale AND the full
// dictionary; I18nProvider (mounted per page shell, unchanged call sites)
// reads it and, when present, lets the URL win — same value on the server
// pass and at hydration, so there is no mismatch by construction.

import { createContext, useCallback, useContext, type ReactNode } from "react";
import type { LocaleCode } from "./codes";
import type { Dict } from "./server";
import { isLocalizedPath } from "@/lib/seo/hreflang";

export interface LocaleBoundaryValue {
  locale: LocaleCode;
  dict: Dict;
}

export const LocaleBoundaryContext = createContext<LocaleBoundaryValue | null>(null);

/**
 * Prefix a root path with the current route's locale, when — and only when —
 * a localized variant of that path exists. On root routes (no boundary) this
 * is the identity function, so links behave exactly as before. This is how
 * localized pages interlink IN-locale, which is also the crawler's path from
 * one localized page to the rest of the localized tree.
 */
export function useLocalizedPath(): (path: string) => string {
  const boundary = useContext(LocaleBoundaryContext);
  return useCallback(
    (path: string) =>
      boundary && isLocalizedPath(path) ? `/${boundary.locale}${path}` : path,
    [boundary],
  );
}

export function LocaleBoundary({
  locale,
  dict,
  children,
}: LocaleBoundaryValue & { children: ReactNode }) {
  return (
    <LocaleBoundaryContext.Provider value={{ locale, dict }}>
      {children}
    </LocaleBoundaryContext.Provider>
  );
}
