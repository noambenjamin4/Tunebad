import type { Metadata } from "next";
import { ToolPageShell } from "@/components/files/ToolPageShell";
import { ToolsHub } from "@/components/files/ToolsHub";

export const metadata: Metadata = {
  title: "Free Online File Tools",
  description:
    "Free file tools that run in your browser: convert, resize, and compress images, and more. No uploads, no sign-up, no ads.",
  alternates: { canonical: "/tools" },
  openGraph: { images: [{ url: "/og/tools.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <ToolPageShell>
      <ToolsHub />
    </ToolPageShell>
  );
}
