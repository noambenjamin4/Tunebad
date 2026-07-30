import type { Metadata } from "next";
import { TunebadApp } from "@/components/TunebadApp";
import { languageAlternates } from "@/lib/seo/hreflang";
import { ToolFaq } from "@/components/files/ToolFaq";

export const metadata: Metadata = {
  title: "Loudness Penalty & LUFS Meter",
  description:
    "Free LUFS loudness meter. Check your track's loudness and see how much Spotify, Apple Music, YouTube, TIDAL, Amazon, and Deezer will turn it down.",
  alternates: { canonical: "/loudness", languages: languageAlternates("/loudness") },
  openGraph: { images: [{ url: "/og/loudness.png", width: 1200, height: 630 }] },
};

export default function Page() {
  // The FAQ rides in as a landingSlot: TunebadApp is a client component,
  // so its body is not in the SSR HTML — a slot passed from this server
  // page is how crawlable content gets in (same mechanism the homepage
  // uses for LandingSeo). It renders only while the initial view is
  // showing, so switching tabs does not leave the wrong tool's FAQ up.
  return (
    <TunebadApp
      initialView="loudness"
      landingSlot={
        <ToolFaq
          faqs={[
          { q: "toolfaq.loudness.q1", a: "toolfaq.loudness.a1" },
          { q: "toolfaq.loudness.q2", a: "toolfaq.loudness.a2" },
          { q: "toolfaq.loudness.q3", a: "toolfaq.loudness.a3" },
          { q: "toolfaq.loudness.q4", a: "toolfaq.loudness.a4" },
          ]}
        />
      }
    />
  );
}
