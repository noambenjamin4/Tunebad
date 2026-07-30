// Localized variant of /mov-to-mp4: the SAME page component, re-exported, with
// locale-aware metadata. The locale reaches the UI via the [locale] layout's
// LocaleBoundary — no props threaded, no page body duplicated.
import type { Metadata } from "next";
import type { LocaleCode } from "@/lib/i18n/codes";
import { localizedPageMetadata } from "@/lib/seo/i18n-metadata";

export { default } from "@/app/(en)/mov-to-mp4/page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return localizedPageMetadata({
    locale: locale as LocaleCode,
    path: "/mov-to-mp4",
    titleKey: "meta.movToMp4.title",
    descriptionKey: "meta.movToMp4.description",
    ogImage: "/og/mov-to-mp4.png",
  });
}
