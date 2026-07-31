import type { Metadata, Viewport } from "next";
import { jsonLdString } from "@/lib/seo/jsonld";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "../globals.css";
import { SITE_URL, SOCIAL_PROFILES } from "@/lib/site";
import { fontVariables } from "@/lib/fonts";
import { sharedRootMetadata, sharedViewport } from "@/lib/seo/base-metadata";
import { languageAlternates } from "@/lib/seo/hreflang";
import { ClientErrorReporter } from "@/components/layout/ClientErrorReporter";

// Brand FIRST on the homepage. Google autocorrects the query "tunebad" to
// "tunebat" (a far older, higher-authority brand one letter away), and with the
// brand buried at the end of the title the pages that actually surfaced for our
// own brand query were /tunebad-vs-tunebat and /songs — not the homepage, which
// should own it. Every keyword is still in the title, just reordered.
const TITLE = "TuneBad — Free Key & BPM Finder for Any Song";
const DESCRIPTION =
  "Find the key, BPM, and loudness of any song for free. Upload a file or paste a YouTube, Spotify, or SoundCloud link and convert it to MP3, WAV, or MP4, all in your browser.";
export const metadata: Metadata = {
  ...sharedRootMetadata,
  title: {
    default: TITLE,
    template: "%s | TuneBad",
  },
  description: DESCRIPTION,
  keywords: [
    "key finder",
    "BPM finder",
    "song key finder",
    "BPM counter",
    "tempo finder",
    "key and BPM finder",
    "music analyzer",
    "loudness meter",
    "LUFS meter",
    "pitch shifter",
    "slowed and reverb",
    "YouTube to MP3",
    "Spotify to MP3",
    "audio converter",
    "TuneBad",
  ],
  alternates: {
    canonical: "/",
    // The homepage is the EN member of the key-bpm-finder hreflang cluster:
    // /key-bpm-finder canonicalizes to "/" (same TunebadApp, same view), and
    // hreflang must point at canonicals — so en/x-default are "/" here, the
    // localized variants hang off /<locale>/key-bpm-finder, and
    // /key-bpm-finder itself carries no hreflang.
    languages: { ...languageAlternates("/key-bpm-finder"), en: "/", "x-default": "/" },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    siteName: "TuneBad",
    type: "website",
    locale: "en_US",
  },
};

export const viewport: Viewport = sharedViewport;

// Static structured data (JSON-LD) so Google understands what TuneBad is and can
// show rich results. Content is a fixed string literal — no user input — so this
// is not an HTML-injection sink.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: "TuneBad",
      // Google's site-name docs recommend a name + alternateName pair; the
      // domain form is the natural alternate.
      alternateName: "tunebad.com",
      description: DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#org` },
      inLanguage: "en",
    },
    {
      // Entity signals. Google has to decide whether "TuneBad" is a real,
      // distinct thing or a typo for "Tunebat" — these are what it reads to
      // tell them apart. alternateName covers the spaced/lowercase spellings
      // people actually type.
      //   NOTE: `sameAs` (links to owned social/knowledge profiles) is the
      // strongest signal here and is deliberately ABSENT: TuneBad has no
      // profiles yet, and pointing sameAs at URLs that don't exist or aren't
      // ours would be invalid markup and a false claim. Add it the day the
      // accounts exist.
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "TuneBad",
      alternateName: ["Tune Bad", "tunebad", "tunebad.com"],
      description: DESCRIPTION,
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icon-512.png`,
      // Omitted entirely until real owned profiles exist (see lib/site.ts).
      ...(SOCIAL_PROFILES.length > 0 ? { sameAs: SOCIAL_PROFILES } : {}),
    },
    {
      "@type": ["WebApplication", "SoftwareApplication"],
      "@id": `${SITE_URL}/#app`,
      name: "TuneBad",
      url: `${SITE_URL}/`,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires JavaScript. Requires HTML5.",
      description: DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Key & BPM finder for any song or link",
        "BPM tap tempo and metronome",
        "Loudness (LUFS) meter",
        "Pitch shifter",
        "Delay & reverb time calculator",
        "Slowed + reverb studio",
        "MP3 cutter and ringtone maker",
        "YouTube, Spotify & SoundCloud to MP3, WAV or MP4 converter",
        "Playlist key & BPM analyzer",
        "Image converter, resizer & compressor (in-browser)",
        "In-browser video compressor (for Discord and more)",
        "Video converter: MP4, WebM, MKV, MOV, AVI, FLV, WMV (in-browser)",
        "Audio converter: MP3, WAV, FLAC, OGG, M4A (in-browser)",
        "PDF merge and JPG to PDF (in-browser)",
        "ZIP and unzip files (in-browser)",
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(STRUCTURED_DATA) }}
        />
      </head>
      <body className={fontVariables}>
        {/* First tabbable element on every page. The full footer alone holds
            34 links; without this, keyboard and screen-reader users walk the
            whole chrome before reaching any tool (WCAG 2.4.1). */}
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
        {/* Cookieless, anonymous page-view counts (no-op in dev). Audio never
            leaves the visitor's device; this does not change that. */}
        <Analytics />
        {/* Field Core Web Vitals from real visits. Lab numbers (Lighthouse)
            were the only perf signal before this, and they cannot see a slow
            phone on a bad connection — which is most of the traffic. */}
        <SpeedInsights />
        {/* Reports uncaught client errors to our own API (no third party —
            the CSP allows no external beacon). Message + stack only. */}
        <ClientErrorReporter />
      </body>
    </html>
  );
}
