import type { Metadata } from "next";
import { TunebadApp } from "@/components/TunebadApp";
import { languageAlternates } from "@/lib/seo/hreflang";
import { ToolFaq } from "@/components/files/ToolFaq";

export const metadata: Metadata = {
  title: "Slowed + Reverb Maker",
  description:
    "Make a slowed and reverb version of any song, or speed it up for a nightcore edit. Set the speed, pitch, and reverb, then export it free in your browser.",
  alternates: { canonical: "/slowed-reverb", languages: languageAlternates("/slowed-reverb") },
  openGraph: { images: [{ url: "/og/slowed-reverb.png", width: 1200, height: 630 }] },
};

export default function Page() {
  // The FAQ rides in as a landingSlot: TunebadApp is a client component,
  // so its body is not in the SSR HTML — a slot passed from this server
  // page is how crawlable content gets in (same mechanism the homepage
  // uses for LandingSeo). It renders only while the initial view is
  // showing, so switching tabs does not leave the wrong tool's FAQ up.
  return (
    <TunebadApp
      initialView="remix"
      landingSlot={
        <ToolFaq
          faqs={[
          { q: "toolfaq.remix.q1", a: "toolfaq.remix.a1" },
          { q: "toolfaq.remix.q2", a: "toolfaq.remix.a2" },
          { q: "toolfaq.remix.q3", a: "toolfaq.remix.a3" },
          { q: "toolfaq.remix.q4", a: "toolfaq.remix.a4" },
          ]}
        />
      }
    />
  );
}
