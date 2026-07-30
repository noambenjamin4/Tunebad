// Localized variant of /converter: the SAME page component, re-exported, with
// locale-aware metadata. The locale itself reaches the UI via the [locale]
// layout's LocaleBoundary — no props threaded, no page body duplicated.
import type { Metadata } from "next";
import type { LocaleCode } from "@/lib/i18n/codes";
import { localizedPageMetadata } from "@/lib/seo/i18n-metadata";

export { default } from "@/app/(en)/converter/page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return localizedPageMetadata({
    locale: locale as LocaleCode,
    path: "/converter",
    titleKey: "meta.converter.title",
    descriptionKey: "meta.converter.description",
    ogImage: "/og/converter.png",
  });
}
