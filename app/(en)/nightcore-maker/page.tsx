import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { RelatedTools } from "@/components/files/RelatedTools";
import { ToolFaq } from "@/components/files/ToolFaq";
import { NightcoreTool } from "@/components/files/NightcoreTool";
import { languageAlternates } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Nightcore Maker: Speed Up & Pitch Up a Song Online",
  description:
    "Turn any song into a nightcore edit right in your browser: speeds it up and raises the pitch together, the classic nightcore sound. Free, no upload, no sign-up.",
  alternates: { canonical: "/nightcore-maker", languages: languageAlternates("/nightcore-maker") },
  openGraph: { images: [{ url: "/og/nightcore-maker.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell tool={{ name: "Nightcore Maker", path: "/nightcore-maker" }}>
      <NightcoreTool />
      <ToolFaq
        faqs={[
          { q: "nightcoretool.faq1Q", a: "nightcoretool.faq1A" },
          { q: "nightcoretool.faq2Q", a: "nightcoretool.faq2A" },
          { q: "nightcoretool.faq3Q", a: "nightcoretool.faq3A" },
        ]}
      />
      <RelatedTools tools={["daw", "bass-booster", "8d-audio", "audio-converter"]} />
    </ToolPageShell>
  );
}
