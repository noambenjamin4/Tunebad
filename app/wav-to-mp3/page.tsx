import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { RelatedTools } from "@/components/files/RelatedTools";
import { ToolFaq } from "@/components/files/ToolFaq";
import { MediaConvertTool } from "@/components/files/MediaConvertTool";

export const metadata: Metadata = {
  title: "WAV to MP3 Converter (Free, In Your Browser)",
  description:
    "Turn huge uncompressed WAV files into small MP3s at 128, 192, or 320 kbps, right in your browser. Files never leave your device. Free, no sign-up.",
  alternates: { canonical: "/wav-to-mp3" },
  openGraph: { images: [{ url: "/og/wav-to-mp3.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell tool={{ name: "WAV to MP3", path: "/wav-to-mp3" }}>
      <MediaConvertTool
        mode="audio"
        titleKey="mediatool.titleWav"
        subtitleKey="mediatool.subtitleWav"
      />
      <ToolFaq
        faqs={[
          { q: "mediatool.faqWav1Q", a: "mediatool.faqWav1A" },
          { q: "mediatool.faqWav2Q", a: "mediatool.faqWav2A" },
          { q: "mediatool.faqWav3Q", a: "mediatool.faqWav3A" },
        ]}
      />
      <RelatedTools tools={["audio-converter", "flac-to-mp3", "video-converter"]} />
    </ToolPageShell>
  );
}
