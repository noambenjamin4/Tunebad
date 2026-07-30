import type { Metadata } from "next";
import { TunebadApp } from "@/components/TunebadApp";
import { languageAlternates } from "@/lib/seo/hreflang";
import { ToolFaq } from "@/components/files/ToolFaq";

export const metadata: Metadata = {
  title: "YouTube & Spotify to MP3 Converter",
  description:
    "Turn YouTube, Spotify, SoundCloud, TikTok, Instagram, and X links into MP3, WAV, or MP4 files with cover art and title tags. Free, no sign-up, no ads.",
  alternates: { canonical: "/converter", languages: languageAlternates("/converter") },
  openGraph: { images: [{ url: "/og/converter.png", width: 1200, height: 630 }] },
};

export default function Page() {
  // The FAQ rides in as a landingSlot: TunebadApp is a client component,
  // so its body is not in the SSR HTML — a slot passed from this server
  // page is how crawlable content gets in (same mechanism the homepage
  // uses for LandingSeo). It renders only while the initial view is
  // showing, so switching tabs does not leave the wrong tool's FAQ up.
  return (
    <TunebadApp
      initialView="converter"
      landingSlot={
        <ToolFaq
          faqs={[
          { q: "toolfaq.converter.q1", a: "toolfaq.converter.a1" },
          { q: "toolfaq.converter.q2", a: "toolfaq.converter.a2" },
          { q: "toolfaq.converter.q3", a: "toolfaq.converter.a3" },
          { q: "toolfaq.converter.q4", a: "toolfaq.converter.a4" },
          ]}
        />
      }
    />
  );
}
