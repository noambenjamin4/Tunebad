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

import { createContext, type ReactNode } from "react";
import type { LocaleCode } from "./codes";
import type { Dict } from "./server";

export interface LocaleBoundaryValue {
  locale: LocaleCode;
  dict: Dict;
}

export const LocaleBoundaryContext = createContext<LocaleBoundaryValue | null>(null);

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
