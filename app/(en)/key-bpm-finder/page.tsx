import type { Metadata } from "next";
import { TunebadApp } from "@/components/TunebadApp";
import { ToolFaq } from "@/components/files/ToolFaq";

export const metadata: Metadata = {
  title: "Song Key & BPM Finder",
  description:
    "Free key and BPM finder. Paste a YouTube, Spotify, or SoundCloud link, or drop an audio file, and get the key, tempo, Camelot code, and loudness of any song.",
  // Canonical to "/" — this route renders the SAME <TunebadApp> on the same
  // view, so the two pages were self-canonical duplicates competing for the
  // site's head term ("key and bpm finder"), and this is the weaker twin (no
  // LandingSeo, no FAQPage JSON-LD). The route stays: it's the analyzer's real
  // URL, linked from the nav and written to the address bar on tab switch.
  alternates: { canonical: "/" },
  openGraph: { images: [{ url: "/og/key-bpm-finder.png", width: 1200, height: 630 }] },
};

export default function Page() {
  // The FAQ rides in as a landingSlot: TunebadApp is a client component,
  // so its body is not in the SSR HTML — a slot passed from this server
  // page is how crawlable content gets in (same mechanism the homepage
  // uses for LandingSeo). It renders only while the initial view is
  // showing, so switching tabs does not leave the wrong tool's FAQ up.
  return (
    <TunebadApp
      initialView="analysis"
      landingSlot={
        <ToolFaq
          faqs={[
          { q: "toolfaq.keyBpm.q1", a: "toolfaq.keyBpm.a1" },
          { q: "toolfaq.keyBpm.q2", a: "toolfaq.keyBpm.a2" },
          { q: "toolfaq.keyBpm.q3", a: "toolfaq.keyBpm.a3" },
          { q: "toolfaq.keyBpm.q4", a: "toolfaq.keyBpm.a4" },
          ]}
        />
      }
    />
  );
}
