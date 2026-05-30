import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tuner | Glass Music Utility",
  description: "A glassy music utility for file analysis, BPM, pitch, delay, reverb, and MP3 downloads.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
