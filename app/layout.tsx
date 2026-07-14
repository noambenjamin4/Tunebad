import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Baloo_2 } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { SITE_URL } from "@/lib/site";
import { ClientErrorReporter } from "@/components/layout/ClientErrorReporter";

const geistSans = Geist({
  // 900 was loaded but never referenced in any stylesheet — dropping it removes
  // a font-file download and its render-blocking preload from every page.
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-mono",
});

const baloo2 = Baloo_2({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
  variable: "--font-display",
});

// Brand FIRST on the homepage. Google autocorrects the query "tunebad" to
// "tunebat" (a far older, higher-authority brand one letter away), and with the
// brand buried at the end of the title the pages that actually surfaced for our
// own brand query were /tunebad-vs-tunebat and /songs — not the homepage, which
// should own it. Every keyword is still in the title, just reordered.
const TITLE = "TuneBad — Free Key & BPM Finder for Any Song";
const DESCRIPTION =
  "Find the key, BPM, and loudness of any song for free. Upload a file or paste a YouTube, Spotify, or SoundCloud link and convert it to MP3, WAV, or MP4, all in your browser.";
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "TuneBad",
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
  authors: [{ name: "TuneBad" }],
  creator: "TuneBad",
  publisher: "TuneBad",
  category: "music",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    siteName: "TuneBad",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  icons: {
    // Adaptive, transparent favicon first: black logo in light mode, white in
    // dark mode (prefers-color-scheme inside the SVG). PNGs are opaque
    // fallbacks for the few contexts that don't render SVG favicons.
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      // 48px is the size multiple Google Search wants for result favicons;
      // app/favicon.ico (48px PNG-in-ICO) covers the /favicon.ico fallback.
      { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "7Kg7htG_MaFzvf4ji62IMkIpmkHznMug-3XSnAzaIAU",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${baloo2.variable}`}>
        {children}
        {/* Cookieless, anonymous page-view counts (no-op in dev). Audio never
            leaves the visitor's device; this does not change that. */}
        <Analytics />
        {/* Reports uncaught client errors to our own API (no third party —
            the CSP allows no external beacon). Message + stack only. */}
        <ClientErrorReporter />
      </body>
    </html>
  );
}
