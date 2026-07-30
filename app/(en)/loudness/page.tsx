import type { Metadata } from "next";
import { TunebadApp } from "@/components/TunebadApp";
import { languageAlternates } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Loudness Penalty & LUFS Meter",
  description:
    "Free LUFS loudness meter. Check your track's loudness and see how much Spotify, Apple Music, YouTube, TIDAL, Amazon, and Deezer will turn it down.",
  alternates: { canonical: "/loudness", languages: languageAlternates("/loudness") },
  openGraph: { images: [{ url: "/og/loudness.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return <TunebadApp initialView="loudness" />;
}
