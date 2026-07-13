import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { RelatedTools } from "@/components/files/RelatedTools";
import { ZipTool } from "@/components/files/ZipTool";

export const metadata: Metadata = {
  title: "Unzip Files Online (ZIP, TAR, TAR.GZ)",
  description:
    "Open a ZIP, TAR, or TAR.GZ archive and download its contents, or bundle files into a new archive. Runs in your browser, nothing uploaded. No sign-up, free.",
  alternates: { canonical: "/unzip-files" },
  openGraph: { images: [{ url: "/og/unzip-files.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell tool={{ name: "Unzip Files", path: "/unzip-files" }}>
      <ZipTool />
      <RelatedTools tools={["merge-pdf", "jpg-to-pdf", "compress-image"]} />
    </ToolPageShell>
  );
}
