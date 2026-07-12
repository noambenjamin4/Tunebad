import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { PdfTool } from "@/components/files/PdfTool";

export const metadata: Metadata = {
  title: "JPG to PDF Converter",
  description:
    "Turn JPG and PNG images into a single PDF, one page per photo. Runs in your browser, nothing gets uploaded. No sign-up, no ads, free.",
  alternates: { canonical: "/jpg-to-pdf" },
  openGraph: { images: [{ url: "/og/jpg-to-pdf.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell>
      <PdfTool mode="images" />
    </ToolPageShell>
  );
}
