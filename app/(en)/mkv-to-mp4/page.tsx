import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { RelatedTools } from "@/components/files/RelatedTools";
import { ToolFaq } from "@/components/files/ToolFaq";
import { MediaConvertTool } from "@/components/files/MediaConvertTool";

export const metadata: Metadata = {
  title: "MKV to MP4 Converter (Free, In Your Browser)",
  description:
    "Convert MKV files from rips, OBS recordings, or downloads to MP4 right in your browser. The file never leaves your device. No watermark, no sign-up.",
  alternates: { canonical: "/mkv-to-mp4" },
  openGraph: { images: [{ url: "/og/mkv-to-mp4.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell tool={{ name: "MKV to MP4", path: "/mkv-to-mp4" }}>
      <MediaConvertTool
        mode="video"
        titleKey="mediatool.titleMkv"
        subtitleKey="mediatool.subtitleMkv"
      />
      <ToolFaq
        faqs={[
          { q: "mediatool.faqMkv1Q", a: "mediatool.faqMkv1A" },
          { q: "mediatool.faqMkv2Q", a: "mediatool.faqMkv2A" },
          { q: "mediatool.faqMkv3Q", a: "mediatool.faqMkv3A" },
        ]}
      />
      <RelatedTools tools={["video-converter", "compress-video", "mov-to-mp4"]} />
    </ToolPageShell>
  );
}
