import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { RelatedTools } from "@/components/files/RelatedTools";
import { ToolFaq } from "@/components/files/ToolFaq";
import { MediaConvertTool } from "@/components/files/MediaConvertTool";

export const metadata: Metadata = {
  title: "MOV to MP4 Converter (Free, In Your Browser)",
  description:
    "Convert iPhone and QuickTime MOV videos to MP4 that plays anywhere, right in your browser. The file never leaves your device. No watermark, no sign-up.",
  alternates: { canonical: "/mov-to-mp4" },
  openGraph: { images: [{ url: "/og/mov-to-mp4.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell tool={{ name: "MOV to MP4", path: "/mov-to-mp4" }}>
      <MediaConvertTool
        mode="video"
        titleKey="mediatool.titleMov"
        subtitleKey="mediatool.subtitleMov"
      />
      <ToolFaq
        faqs={[
          { q: "mediatool.faqMov1Q", a: "mediatool.faqMov1A" },
          { q: "mediatool.faqMov2Q", a: "mediatool.faqMov2A" },
          { q: "mediatool.faqMov3Q", a: "mediatool.faqMov3A" },
        ]}
      />
      <RelatedTools tools={["video-converter", "compress-video", "mkv-to-mp4"]} />
    </ToolPageShell>
  );
}
