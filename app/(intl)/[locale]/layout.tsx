// The SECOND root layout: localized routes (/fr/daw, /es/mp3-cutter, ...).
//
// A nested layout cannot render <html>, and the (en) root layout cannot see a
// [locale] param below it — two root layouts via route groups is the one
// correct App Router mechanism for serving <html lang={locale}> documents
// while English stays unprefixed at the root. Route groups are invisible in
// URLs, so /fr/daw is exactly what it looks like.
//
// generateStaticParams + dynamicParams=false: only the 7 real locales build;
// /xx/anything falls through to the (en) tree's not-found. Every page in
// this tree is fully static with no data fetches — ~35 pilot pages of pure
// prerender, zero ISR involvement.

import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import "../../globals.css";
import { fontVariables } from "@/lib/fonts";
import { sharedRootMetadata, sharedViewport } from "@/lib/seo/base-metadata";
import { LOCALE_CODES, type LocaleCode } from "@/lib/i18n/codes";
import { getDict } from "@/lib/i18n/server";
import { LocaleBoundary } from "@/lib/i18n/LocaleBoundary";
import { ClientErrorReporter } from "@/components/layout/ClientErrorReporter";

export const dynamicParams = false;

export function generateStaticParams(): { locale: string }[] {
  return LOCALE_CODES.filter((code) => code !== "en").map((locale) => ({ locale }));
}

// MUST re-declare metadataBase (via sharedRootMetadata): each root layout
// tree inherits metadata separately, and without it every relative
// canonical/hreflang under /fr/... would emit unresolved.
export const metadata: Metadata = {
  ...sharedRootMetadata,
  title: {
    default: "TuneBad",
    template: "%s | TuneBad",
  },
};

export const viewport: Viewport = sharedViewport;

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const code = locale as LocaleCode;
  // The full dict rides the RSC payload — that is what lets the client
  // provider render the route's language on the FIRST paint, no loader
  // round-trip, no hydration mismatch (both passes read this same context).
  const dict = getDict(code);
  return (
    <html lang={code}>
      <body className={fontVariables}>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <LocaleBoundary locale={code} dict={dict}>
          {children}
        </LocaleBoundary>
        <Analytics />
        <ClientErrorReporter />
      </body>
    </html>
  );
}
