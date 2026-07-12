import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { VideoTool } from "@/components/files/VideoTool";

export const metadata: Metadata = {
  title: "Compress Video Online (No Upload)",
  description:
    "Shrink a video to 10, 25, 50, or 100 MB right in your browser. The file never leaves your device. Free, no sign-up, no watermark.",
  alternates: { canonical: "/compress-video" },
  openGraph: { images: [{ url: "/og/compress-video.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell>
      <VideoTool
        titleKey="vidtool.titleGeneric"
        subtitleKey="vidtool.subtitleGeneric"
        targetPresetsMB={[10, 25, 50, 100]}
        defaultTargetMB={25}
      />
    </ToolPageShell>
  );
}
