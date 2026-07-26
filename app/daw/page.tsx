import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { RelatedTools } from "@/components/files/RelatedTools";
import { ToolFaq } from "@/components/files/ToolFaq";
import { StudioClient } from "@/components/studio/StudioClient";

export const metadata: Metadata = {
  title: "TuneBad DAW: Mix Songs on a Timeline Online",
  description:
    "Put multiple songs on one timeline, see the waveforms, drag them to overlap for beat switches, cut and split, add live slowed + reverb and phone effects, then export as MP3 or WAV. Free, in your browser.",
  alternates: { canonical: "/daw" },
  openGraph: { images: [{ url: "/og/daw.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell tool={{ name: "TuneBad DAW", path: "/daw" }}>
      <StudioClient />
      <ToolFaq
        faqs={[
          { q: "studio.faq1Q", a: "studio.faq1A" },
          { q: "studio.faq2Q", a: "studio.faq2A" },
          { q: "studio.faq3Q", a: "studio.faq3A" },
        ]}
      />
      <RelatedTools tools={["audio-joiner", "audio-converter", "wav-to-mp3"]} />
    </ToolPageShell>
  );
}
