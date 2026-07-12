import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { VideoTool } from "@/components/files/VideoTool";

export const metadata: Metadata = {
  title: "Compress Video for Discord (Under 10MB)",
  description:
    "Get a video under Discord's 10MB upload limit in your browser, no upload and no watermark. Presets for 10MB free tier and 50MB Nitro Basic.",
  alternates: { canonical: "/compress-video-for-discord" },
  openGraph: { images: [{ url: "/og/compress-video-discord.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell>
      <VideoTool
        titleKey="vidtool.titleDiscord"
        subtitleKey="vidtool.subtitleDiscord"
        noteKey="vidtool.discordNote"
        targetPresetsMB={[10, 25, 50]}
        defaultTargetMB={10}
      />
    </ToolPageShell>
  );
}
