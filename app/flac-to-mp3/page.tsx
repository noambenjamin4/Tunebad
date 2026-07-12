import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { RelatedTools } from "@/components/files/RelatedTools";
import { ToolFaq } from "@/components/files/ToolFaq";
import { MediaConvertTool } from "@/components/files/MediaConvertTool";

export const metadata: Metadata = {
  title: "FLAC to MP3 Converter (Pick the Bitrate)",
  description:
    "Convert lossless FLAC files to MP3 at 128, 192, or 320 kbps, right in your browser. Your music never leaves your device. Free, no sign-up, no ads.",
  alternates: { canonical: "/flac-to-mp3" },
  openGraph: { images: [{ url: "/og/flac-to-mp3.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell tool={{ name: "FLAC to MP3", path: "/flac-to-mp3" }}>
      <MediaConvertTool
        mode="audio"
        titleKey="mediatool.titleFlac"
        subtitleKey="mediatool.subtitleFlac"
      />
      <ToolFaq
        faqs={[
          { q: "mediatool.faqFlac1Q", a: "mediatool.faqFlac1A" },
          { q: "mediatool.faqFlac2Q", a: "mediatool.faqFlac2A" },
          { q: "mediatool.faqFlac3Q", a: "mediatool.faqFlac3A" },
        ]}
      />
      <RelatedTools tools={["audio-converter", "wav-to-mp3", "video-converter"]} />
    </ToolPageShell>
  );
}
