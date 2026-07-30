// Localized variant of /mkv-to-mp4: the SAME page component, re-exported, with
// locale-aware metadata. The locale reaches the UI via the [locale] layout's
// LocaleBoundary — no props threaded, no page body duplicated.
import type { Metadata } from "next";
import type { LocaleCode } from "@/lib/i18n/codes";
import { localizedPageMetadata } from "@/lib/seo/i18n-metadata";

export { default } from "@/app/(en)/mkv-to-mp4/page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return localizedPageMetadata({
    locale: locale as LocaleCode,
    path: "/mkv-to-mp4",
    titleKey: "meta.mkvToMp4.title",
    descriptionKey: "meta.mkvToMp4.description",
    ogImage: "/og/mkv-to-mp4.png",
  });
}
