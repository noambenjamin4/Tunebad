import type { Metadata } from "next";
import { TunebadApp } from "@/components/TunebadApp";

export const metadata: Metadata = {
  title: "YouTube & Spotify to MP3 Converter",
  description:
    "Turn YouTube, Spotify, SoundCloud, TikTok, Instagram, and X links into MP3, WAV, or MP4 files with cover art and title tags. Free, no sign-up, no ads.",
  alternates: { canonical: "/converter" },
  openGraph: { images: [{ url: "/og/converter.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return <TunebadApp initialView="converter" />;
}
