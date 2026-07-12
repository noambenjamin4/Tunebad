import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { RelatedTools } from "@/components/files/RelatedTools";
import { ToolFaq } from "@/components/files/ToolFaq";
import { VideoTool } from "@/components/files/VideoTool";

export const metadata: Metadata = {
  title: "Compress Video for WhatsApp (Under 16MB)",
  description:
    "Get a video under WhatsApp's 16MB share limit in your browser, no upload and no watermark. Presets for 16, 25, and 50 MB.",
  alternates: { canonical: "/compress-video-for-whatsapp" },
  openGraph: { images: [{ url: "/og/compress-video-whatsapp.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell tool={{ name: "Compress for WhatsApp", path: "/compress-video-for-whatsapp" }}>
      <VideoTool
        titleKey="vidtool.titleWhatsapp"
        subtitleKey="vidtool.subtitleWhatsapp"
        noteKey="vidtool.whatsappNote"
        targetPresetsMB={[16, 25, 50]}
        defaultTargetMB={16}
      />
      <ToolFaq
        faqs={[
          { q: "vidtool.faqWhatsapp1Q", a: "vidtool.faqWhatsapp1A" },
          { q: "vidtool.faqWhatsapp2Q", a: "vidtool.faqWhatsapp2A" },
          { q: "vidtool.faqWhatsapp3Q", a: "vidtool.faqWhatsapp3A" },
          { q: "vidtool.faqWhatsapp4Q", a: "vidtool.faqWhatsapp4A" },
        ]}
      />
      <RelatedTools tools={["compress-video-for-discord", "compress-video", "video-converter"]} />
    </ToolPageShell>
  );
}
