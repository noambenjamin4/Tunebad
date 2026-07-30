// generateMetadata for the (intl)/[locale] pages: localized title and
// description from the server dicts, a self-canonical, and the same
// hreflang cluster the EN page emits. Relative URLs resolve against the
// intl root layout's metadataBase.

import type { Metadata } from "next";
import type { DictKey } from "@/lib/i18n/locales/en";
import { getDict, translate } from "@/lib/i18n/server";
import type { LocaleCode } from "@/lib/i18n/codes";
import { languageAlternates, localizedHref } from "./hreflang";

/** og:locale spellings per locale (og wants language_TERRITORY). */
const OG_LOCALE: Record<LocaleCode, string> = {
  en: "en_US",
  fr: "fr_FR",
  es: "es_ES",
  de: "de_DE",
  pt: "pt_BR",
  it: "it_IT",
  ja: "ja_JP",
  zh: "zh_CN",
};

export function localizedPageMetadata(options: {
  locale: LocaleCode;
  path: string;
  titleKey: DictKey;
  descriptionKey: DictKey;
  ogImage?: string;
}): Metadata {
  const { locale, path, titleKey, descriptionKey, ogImage } = options;
  const dict = getDict(locale);
  const title = translate(dict, titleKey);
  const description = translate(dict, descriptionKey);
  const href = localizedHref(path, locale);
  return {
    title,
    description,
    alternates: {
      canonical: href,
      languages: languageAlternates(path),
    },
    openGraph: {
      title,
      description,
      url: href,
      locale: OG_LOCALE[locale],
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
  };
}
