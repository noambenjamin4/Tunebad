import type { Metadata } from "next";
import { TunebadApp } from "@/components/TunebadApp";

export const metadata: Metadata = {
  title: "Frequency to Note Calculator — Hz to Pitch & Cents",
  description:
    "Convert any frequency in Hz to the nearest musical note, octave, and cents offset. Free, in your browser. To change a song's pitch, use the nightcore maker.",
  alternates: { canonical: "/pitch-shifter" },
  openGraph: { images: [{ url: "/og/pitch-shifter.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return <TunebadApp initialView="pitch" />;
}
