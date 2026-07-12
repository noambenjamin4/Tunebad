import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { ImageTool } from "@/components/files/ImageTool";

export const metadata: Metadata = {
  title: "Image Converter: PNG, JPG & WebP",
  description:
    "Convert images between PNG, JPG, and WebP right in your browser. Files never leave your device. Free, no sign-up, no ads.",
  alternates: { canonical: "/image-converter" },
  openGraph: { images: [{ url: "/og/image-converter.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell>
      <ImageTool mode="convert" titleKey="imgtool.titleConvert" subtitleKey="imgtool.subtitleConvert" />
    </ToolPageShell>
  );
}
