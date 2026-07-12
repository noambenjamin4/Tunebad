import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { PdfTool } from "@/components/files/PdfTool";

export const metadata: Metadata = {
  title: "Merge PDF Files Online",
  description:
    "Combine multiple PDF files into one document, in the order you choose. Runs in your browser, nothing gets uploaded. No sign-up, no ads, free.",
  alternates: { canonical: "/merge-pdf" },
  openGraph: { images: [{ url: "/og/merge-pdf.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell>
      <PdfTool mode="merge" />
    </ToolPageShell>
  );
}
