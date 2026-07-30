// Server-side dictionary access for localized routes.
//
// The locale dictionaries are plain TS object modules (no "use client"
// directive), so a server layout or generateMetadata can import them
// directly. This map is STATIC imports on purpose: the localized tree
// serializes the full dict into the RSC payload anyway (that is how the
// client provider renders the right language on first paint with no
// hydration mismatch), so there is nothing to code-split here — and a
// static map cannot 404 at runtime the way a dynamic import path could.
//
// Client code must NOT import this module (it would pull all 8 dicts into
// the bundle); the client keeps its code-split loaders in lib/i18n/index.tsx.

import type { LocaleCode } from "./codes";
import en, { type DictKey } from "./locales/en";
import fr from "./locales/fr";
import es from "./locales/es";
import de from "./locales/de";
import pt from "./locales/pt";
import it from "./locales/it";
import ja from "./locales/ja";
import zh from "./locales/zh";

export type Dict = Record<DictKey, string>;

const DICTS: Record<LocaleCode, Dict> = { en, fr, es, de, pt, it, ja, zh };

export function getDict(locale: LocaleCode): Dict {
  return DICTS[locale] ?? en;
}

/** Server-side `t()` for metadata: dict lookup with {var} interpolation. */
export function translate(dict: Dict, key: DictKey, vars?: Record<string, string | number>): string {
  let text = dict[key] ?? en[key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
    }
  }
  return text;
}
