import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guides/GuideShell";
import { jsonLdString, softwareAppJsonLd } from "@/lib/seo/jsonld";

const TITLE = "TuneBad Chrome Extension: Audio Tools in Your Toolbar";
const DESCRIPTION =
  "Record any tab's audio, find its BPM and key, meter loudness, make a slowed + reverb edit, and convert or compress audio — from the toolbar, on your own device.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/extension" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/extension" },
};

// Every claim below must match the extension's manifest and its store
// listing (~/Code/tunebad-extension/STORE_LISTING.md). If a permission or a
// tool changes there, it changes here — a landing page that overstates what
// the extension does is exactly the kind of contradiction store review
// looks for, and the privacy policy at /privacy is the third copy that has
// to agree.
const APP_LD = softwareAppJsonLd({
  name: "TuneBad — Audio Toolkit",
  description: DESCRIPTION,
  url: "https://www.tunebad.com/extension",
  features: [
    "Record any tab's audio and trim it",
    "Find BPM and musical key on-device",
    "Loudness (LUFS) meter with streaming targets",
    "Slowed + reverb editing",
    "Audio convert and compress",
    "Send a clip straight into the TuneBad DAW",
  ],
});

export default function Page() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path="/extension" datePublished="2026-07-30">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(APP_LD) }} />
      <h1 className="legal-title">TuneBad for Chrome</h1>
      <p>
        The same tools as the website, one click from wherever you already are. Sample audio out of a tab, find
        what key and tempo it is, check how loud it is against what streaming services expect, or slow it down and
        drown it in reverb — without leaving the page you are on.
      </p>

      <h2>What it does</h2>
      <ul>
        <li>
          <strong>Sampler.</strong> Record what is playing in a tab, trim the take, loop it, fade it, and save it
          as WAV or MP3.
        </li>
        <li>
          <strong>Analyze.</strong> BPM, musical key, and Camelot code for a file or a recording, computed on your
          machine.
        </li>
        <li>
          <strong>Loudness.</strong> An LUFS meter with the targets Spotify, Apple Music, and YouTube normalize to.
        </li>
        <li>
          <strong>Remix.</strong> Speed, pitch, and reverb — the slowed + reverb sound, or nightcore going the
          other way.
        </li>
        <li>
          <strong>Tempo &amp; Convert.</strong> Tap tempo, and audio conversion or compression between MP3, WAV,
          and more.
        </li>
        <li>
          <strong>Open in DAW.</strong> Hand a clip you just recorded straight to{" "}
          <Link href="/daw">the TuneBad DAW</Link> — it lands on the timeline instead of going through your
          downloads folder.
        </li>
      </ul>

      <h2>What it does not do</h2>
      <p>
        It does not upload your audio. Every tool runs on your own device, the same as the website. The extension
        asks for one host permission, <code>https://www.tunebad.com/*</code>, and uses it for exactly one thing:
        a content script on <code>/daw</code> that hands a clip over when you press &ldquo;Open in DAW&rdquo;. It
        does not read the page, does not run anywhere else, and sends nothing anywhere. The full breakdown is in
        the <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2>Getting it</h2>
      <p>
        The extension is being submitted to the Chrome Web Store; this page will carry the install link the moment
        it is live. Nothing on the website depends on it — every tool here works on its own, and the extension is
        a shortcut, not a requirement.
      </p>

      <h2>Or just use the site</h2>
      <p>
        <Link href="/key-bpm-finder">Key &amp; BPM finder</Link>, <Link href="/daw">the DAW</Link>,{" "}
        <Link href="/mp3-cutter">MP3 cutter</Link>, <Link href="/slowed-reverb">slowed + reverb</Link>,{" "}
        <Link href="/loudness">loudness meter</Link>, and <Link href="/tools">the file tools</Link> all run in any
        browser, no install.
      </p>
    </GuideShell>
  );
}
