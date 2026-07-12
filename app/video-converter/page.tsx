import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { MediaConvertTool } from "@/components/files/MediaConvertTool";

export const metadata: Metadata = {
  title: "Video Converter: MP4, WebM, MKV, MOV, AVI & More",
  description:
    "Convert AVI to MP4, MKV to MP4, WebM to MP4, MOV, FLV, or WMV right in your browser. The video never leaves your device. Free, no sign-up, no watermark.",
  alternates: { canonical: "/video-converter" },
  openGraph: { images: [{ url: "/og/video-converter.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell>
      <MediaConvertTool
        mode="video"
        titleKey="mediatool.titleVideo"
        subtitleKey="mediatool.subtitleVideo"
      />
    </ToolPageShell>
  );
}
