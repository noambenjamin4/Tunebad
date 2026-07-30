// The three site fonts, instantiated ONCE and shared by both root layouts —
// app/(en)/layout.tsx and app/(intl)/[locale]/layout.tsx. next/font requires
// module-scope instantiation; keeping the calls in a shared module means the
// two layouts cannot drift to different weights or variables.

import { Geist, Geist_Mono, Baloo_2 } from "next/font/google";

const geistSans = Geist({
  // 900 was loaded but never referenced in any stylesheet — dropping it
  // removes a font-file download and its render-blocking preload.
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

/** The className both layouts put on <body>. */
export const fontVariables = `${geistSans.variable} ${geistMono.variable} ${baloo2.variable}`;
