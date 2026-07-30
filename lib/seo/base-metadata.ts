// Metadata fields BOTH root layouts must declare identically. With two root
// layouts (route groups (en) and (intl)), each tree inherits metadata
// separately — metadataBase in particular MUST be re-declared in the intl
// layout or every relative canonical/hreflang under /fr/... would emit
// unresolved. Shared here so the two cannot drift.

import type { Metadata, Viewport } from "next";
import { SITE_URL } from "@/lib/site";

export const sharedRootMetadata: Pick<
  Metadata,
  "metadataBase" | "applicationName" | "authors" | "creator" | "publisher" | "category" | "twitter" | "icons" | "manifest" | "robots"
> = {
  metadataBase: new URL(SITE_URL),
  applicationName: "TuneBad",
  authors: [{ name: "TuneBad" }],
  creator: "TuneBad",
  publisher: "TuneBad",
  category: "music",
  // Card TYPE only, no title/description — a title here would override every
  // child page's correct og:title (X falls back to og:* when twitter:* is
  // absent, which is the behaviour we want).
  twitter: {
    card: "summary_large_image",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
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
};

export const sharedViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};
