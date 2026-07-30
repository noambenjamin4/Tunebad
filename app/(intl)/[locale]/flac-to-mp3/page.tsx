// Localized variant of /flac-to-mp3: the SAME page component, re-exported, with
// locale-aware metadata. The locale reaches the UI via the [locale] layout's
// LocaleBoundary — no props threaded, no page body duplicated.
import type { Metadata } from "next";
import type { LocaleCode } from "@/lib/i18n/codes";
import { localizedPageMetadata } from "@/lib/seo/i18n-metadata";

export { default } from "@/app/(en)/flac-to-mp3/page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return localizedPageMetadata({
    locale: locale as LocaleCode,
    path: "/flac-to-mp3",
    titleKey: "meta.flacToMp3.title",
    descriptionKey: "meta.flacToMp3.description",
    ogImage: "/og/flac-to-mp3.png",
  });
}
