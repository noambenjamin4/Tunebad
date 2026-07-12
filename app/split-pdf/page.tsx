import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { RelatedTools } from "@/components/files/RelatedTools";
import { PdfSplitTool } from "@/components/files/PdfSplitTool";

export const metadata: Metadata = {
  title: "Split PDF: Extract Pages Online",
  description:
    "Pull a range of pages out of a PDF into a new file, right in your browser. Nothing gets uploaded. No sign-up, no ads, free.",
  alternates: { canonical: "/split-pdf" },
  openGraph: { images: [{ url: "/og/split-pdf.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell tool={{ name: "Split PDF", path: "/split-pdf" }}>
      <PdfSplitTool />
      <RelatedTools tools={["merge-pdf", "jpg-to-pdf", "unzip-files"]} />
    </ToolPageShell>
  );
}
