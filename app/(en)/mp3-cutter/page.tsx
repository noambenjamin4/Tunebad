import type { Metadata } from "next";
import { TunebadApp } from "@/components/TunebadApp";
import { languageAlternates } from "@/lib/seo/hreflang";
import { ToolFaq } from "@/components/files/ToolFaq";

export const metadata: Metadata = {
  title: "MP3 Cutter and Ringtone Maker",
  description:
    "Cut MP3, WAV, and other audio files in your browser. Trim a song to the part you want, add a fade, and save it as an MP3 or WAV. Free, no upload, no signup.",
  alternates: { canonical: "/mp3-cutter", languages: languageAlternates("/mp3-cutter") },
  openGraph: { images: [{ url: "/og/mp3-cutter.png", width: 1200, height: 630 }] },
};

export default function Page() {
  // The FAQ rides in as a landingSlot: TunebadApp is a client component,
  // so its body is not in the SSR HTML — a slot passed from this server
  // page is how crawlable content gets in (same mechanism the homepage
  // uses for LandingSeo). It renders only while the initial view is
  // showing, so switching tabs does not leave the wrong tool's FAQ up.
  return (
    <TunebadApp
      initialView="cutter"
      landingSlot={
        <ToolFaq
          faqs={[
          { q: "toolfaq.cutter.q1", a: "toolfaq.cutter.a1" },
          { q: "toolfaq.cutter.q2", a: "toolfaq.cutter.a2" },
          { q: "toolfaq.cutter.q3", a: "toolfaq.cutter.a3" },
          { q: "toolfaq.cutter.q4", a: "toolfaq.cutter.a4" },
          ]}
        />
      }
    />
  );
}
