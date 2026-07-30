import type { Metadata } from "next";
import { TunebadApp } from "@/components/TunebadApp";

export const metadata: Metadata = {
  title: "Delay & Reverb Time Calculator",
  description:
    "Free delay and reverb time calculator. Enter a BPM and get delay times in ms and Hz from 1/1 to 1/64, plus reverb pre-delay and decay presets.",
  alternates: { canonical: "/delay-reverb-calculator" },
  openGraph: { images: [{ url: "/og/delay-reverb-calculator.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return <TunebadApp initialView="delay" />;
}
