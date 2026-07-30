import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guides/GuideShell";
import { breadcrumbJsonLd, jsonLdString } from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/site";

const TITLE = "TuneBad Guides: Key, BPM, Mixing & Audio How-Tos";
const DESCRIPTION =
  "Plain-language guides to finding a song's key and BPM, mixing in key with the Camelot wheel, streaming loudness, slowed + reverb, ringtones, and beat switches.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/guides" },
};

// The six guides, newest-value first. This page exists because the leaf
// guides had no index: they were reachable only from the footer and from
// whichever tool page happened to link one, so the set never read as a
// library and a visitor who finished one had nowhere obvious to go next.
const GUIDES: { path: string; title: string; blurb: string }[] = [
  {
    path: "/guides/how-to-make-a-beat-switch",
    title: "How to make a beat switch",
    blurb:
      "What a beat switch actually is, where to put it, and how to line two songs up when their tempos disagree.",
  },
  {
    path: "/guides/find-key-and-bpm-of-any-song",
    title: "Find the key and BPM of any song",
    blurb:
      "Three ways to get a track's key and tempo, why estimators disagree about half and double time, and how to tell which answer is right.",
  },
  {
    path: "/guides/camelot-wheel-harmonic-mixing",
    title: "The Camelot wheel and harmonic mixing",
    blurb:
      "How the 24 codes work, which pairs mix cleanly, and how to plan a set that never clashes in key.",
  },
  {
    path: "/guides/how-to-make-slowed-and-reverb",
    title: "How to make a slowed + reverb edit",
    blurb:
      "The speed, pitch, and reverb settings behind the sound, and why slowing a track drops its pitch with it.",
  },
  {
    path: "/guides/what-is-lufs-streaming-loudness",
    title: "What is LUFS, and streaming loudness",
    blurb:
      "What LUFS measures, the targets Spotify and Apple Music normalize to, and why a louder master is not a louder stream.",
  },
  {
    path: "/guides/how-to-make-a-ringtone",
    title: "How to make a ringtone",
    blurb: "Trim a song to the right length, fade it properly, and save it in a format your phone accepts.",
  },
];

const BREADCRUMBS = breadcrumbJsonLd([
  { name: "TuneBad", item: `${SITE_URL}/` },
  { name: "Guides", item: `${SITE_URL}/guides` },
]);

export default function Page() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path="/guides" datePublished="2026-07-30">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(BREADCRUMBS) }} />
      <h1 className="legal-title">Guides</h1>
      <p>
        Short, practical write-ups on the things the tools do — what the numbers mean, which setting matters, and
        the mistakes that are easy to make once and confusing forever. Every one is free to read and links to the
        tool it describes.
      </p>

      <ul className="guide-index">
        {GUIDES.map((guide) => (
          <li key={guide.path}>
            <Link href={guide.path}>
              <strong>{guide.title}</strong>
            </Link>
            <span>{guide.blurb}</span>
          </li>
        ))}
      </ul>

      <h2>Start with a tool instead</h2>
      <p>
        If you already know what you need: <Link href="/key-bpm-finder">key &amp; BPM finder</Link>,{" "}
        <Link href="/daw">the DAW</Link> for beat switches, <Link href="/mp3-cutter">MP3 cutter</Link>,{" "}
        <Link href="/slowed-reverb">slowed + reverb</Link>, <Link href="/loudness">loudness meter</Link>, or{" "}
        <Link href="/camelot-wheel">the Camelot wheel</Link>.
      </p>
    </GuideShell>
  );
}
