import type { Metadata } from "next";
import { TunebadApp } from "@/components/TunebadApp";

export const metadata: Metadata = {
  title: "Song Key & BPM Finder",
  description:
    "Free key and BPM finder. Paste a YouTube, Spotify, or SoundCloud link, or drop an audio file, and get the key, tempo, Camelot code, and loudness of any song.",
  alternates: { canonical: "/key-bpm-finder" },
  openGraph: { images: [{ url: "/og/key-bpm-finder.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return <TunebadApp initialView="analysis" />;
}
