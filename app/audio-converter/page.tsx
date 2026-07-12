import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { MediaConvertTool } from "@/components/files/MediaConvertTool";

export const metadata: Metadata = {
  title: "Audio Converter: MP3, WAV, FLAC, OGG & M4A",
  description:
    "Convert FLAC to MP3, M4A to MP3, WAV, OGG, and more right in your browser. Pick the MP3 bitrate. Files never leave your device. Free, no sign-up, no ads.",
  alternates: { canonical: "/audio-converter" },
  openGraph: { images: [{ url: "/og/audio-converter.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell>
      <MediaConvertTool
        mode="audio"
        titleKey="mediatool.titleAudio"
        subtitleKey="mediatool.subtitleAudio"
      />
    </ToolPageShell>
  );
}
