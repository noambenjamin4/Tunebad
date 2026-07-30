import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { RelatedTools } from "@/components/files/RelatedTools";
import { ToolFaq } from "@/components/files/ToolFaq";
import { StudioClient } from "@/components/studio/StudioClient";
import { DawSeo } from "@/components/studio/DawSeo";
import { SITE_URL } from "@/lib/site";
import { jsonLdString, softwareAppJsonLd } from "@/lib/seo/jsonld";
import { languageAlternates } from "@/lib/seo/hreflang";

const DESCRIPTION =
  "Put up to 12 songs on one timeline, see the waveforms, drag them to overlap for a beat switch, cut and split, add live slowed + reverb and phone effects, then export as MP3 or WAV. Free, in your browser, nothing uploaded.";

export const metadata: Metadata = {
  // Leads with what people search for — "free online DAW", "mix songs
  // together" — rather than the product name, which nobody is looking for yet.
  title: "Free Online DAW: Mix Multiple Songs on One Timeline",
  description: DESCRIPTION,
  keywords: [
    "online DAW",
    "free DAW no download",
    "mix two songs together online",
    "beat switch maker",
    "browser music editor",
    "overlap songs online",
  ],
  alternates: { canonical: "/daw", languages: languageAlternates("/daw") },
  openGraph: { images: [{ url: "/og/daw.png", width: 1200, height: 630 }] },
};

const SOFTWARE = softwareAppJsonLd({
  name: "TuneBad DAW",
  description: DESCRIPTION,
  url: `${SITE_URL}/daw`,
  features: [
    "Up to 12 songs on one timeline",
    "A waveform for every clip",
    "Free overlap, so two songs can play at once for a beat switch",
    "Equal-power crossfades and per-clip fades",
    "Cut, split, trim and per-clip volume",
    "Tempo detection with a beat grid and one-click tempo matching",
    "Live slowed, reverb, bass, phone, lo-fi and underwater effects",
    "Records knob moves as a performance and bounces exactly what you heard",
    "MP3 and WAV export",
    "Runs entirely in the browser: no upload, no account",
  ],
});

export default function Page() {
  return (
    <ToolPageShell tool={{ name: "TuneBad DAW", path: "/daw" }}>
      <StudioClient />
      <DawSeo />
      <ToolFaq
        faqs={[
          { q: "studio.faq1Q", a: "studio.faq1A" },
          { q: "studio.faq2Q", a: "studio.faq2A" },
          { q: "studio.faq3Q", a: "studio.faq3A" },
          { q: "studio.faq4Q", a: "studio.faq4A" },
          { q: "studio.faq5Q", a: "studio.faq5A" },
        ]}
      />
      <RelatedTools tools={["audio-joiner", "audio-converter", "wav-to-mp3"]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(SOFTWARE) }}
      />
    </ToolPageShell>
  );
}
