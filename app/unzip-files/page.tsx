import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { ZipTool } from "@/components/files/ZipTool";

export const metadata: Metadata = {
  title: "Unzip Files Online (and Make ZIPs)",
  description:
    "Open a ZIP archive and download its contents, or bundle files into a new ZIP. Runs in your browser, nothing gets uploaded. No sign-up, no ads, free.",
  alternates: { canonical: "/unzip-files" },
  openGraph: { images: [{ url: "/og/unzip-files.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell>
      <ZipTool />
    </ToolPageShell>
  );
}
