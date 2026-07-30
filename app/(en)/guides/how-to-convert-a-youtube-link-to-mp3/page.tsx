import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guides/GuideShell";
import { howToJsonLd, jsonLdString } from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/site";

const TITLE = "How to Convert a YouTube Link to MP3 (Free)";
const DESCRIPTION =
  "Paste a link, pick a format, get a tagged MP3. Which bitrate to choose, why 320 kbps is headroom and not extra detail, MP3 vs WAV vs MP4, and where the line is.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/how-to-convert-a-youtube-link-to-mp3" },
  openGraph: { images: [{ url: "/og/converter.png", width: 1200, height: 630 }] },
};

const HOW_TO = howToJsonLd({
  name: TITLE,
  description: DESCRIPTION,
  steps: [
    "Open the TuneBad converter and paste your YouTube, Spotify, SoundCloud, TikTok, Instagram, or X link into the link field.",
    "Choose an output format: MP3 for everyday use, WAV to avoid a second lossy encode, M4A or OPUS for the smallest high-quality file, or MP4 to keep the video.",
    "If you picked MP3, choose a bitrate: 320, 256, 192, or 128 kbps.",
    "Optionally tick “Download only a section” and type a start and end time to get just part of the track.",
    "Click Convert and wait while the server fetches the stream and encodes it.",
    "Click the download link to save the file, with the title and cover art already written into it.",
  ],
  url: `${SITE_URL}/guides/how-to-convert-a-youtube-link-to-mp3`,
});

export default function Page() {
  return (
    <GuideShell
      title={TITLE}
      description={DESCRIPTION}
      path="/guides/how-to-convert-a-youtube-link-to-mp3"
      datePublished="2026-07-30"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(HOW_TO) }} />
      <h1 className="legal-title">{TITLE}</h1>
      <p className="legal-updated">Updated 2026-07-30</p>

      <p>
        Pasting a link into a converter takes two seconds. Ending up with a file that sounds right, is tagged
        properly, and whose limits you understand takes a little more. Here is the whole thing, including the parts
        most converters leave out.
      </p>

      <h2>A link is not a file</h2>
      <p>
        Worth being clear about this first, because it is the one place TuneBad works differently from the rest of
        the site. Your browser cannot reach into YouTube and pull the audio out on its own. That fetch has to be made
        by a server, so when you paste a link, our server retrieves the stream, encodes it, and hands the result
        back to you. Any tool that claims a pasted link is processed entirely in your browser is describing something
        that is not possible.
      </p>
      <p>
        Local files are the opposite. If the song is already on your machine, the second card on the{" "}
        <Link href="/converter">converter</Link> page encodes it in your browser and the audio never leaves your
        computer. The <Link href="/audio-converter">audio converter</Link> works the same way for FLAC, OGG, and
        M4A. Same page, two genuinely different paths.
      </p>

      <h2>The steps</h2>
      <p>
        Paste the link. YouTube, Spotify, SoundCloud, TikTok, Instagram, X, Bandcamp, Vimeo, Mixcloud, and Audiomack
        all work. Pick a format, and for MP3 pick a bitrate. Leave &ldquo;auto-trim silent intro&rdquo; on unless you
        need the leading silence for something &mdash; it shaves the dead air off the front. Then hit convert and
        watch the progress bar. When it finishes you get a download link, and if auto-analyze is on the file is
        handed straight to the <Link href="/key-bpm-finder">key &amp; BPM finder</Link>, so the tempo and key are
        waiting for you without a second upload.
      </p>

      <h2>Which bitrate, and the honest ceiling</h2>
      <p>
        320 kbps is the default and it is the right default, but not for the reason it is usually sold. What a
        streaming platform serves you is already a compressed stream, typically somewhere around 128 to 160 kbps.
        Re-encoding that at 320 kbps does not restore anything. There is no hidden detail in the file to recover, and
        nothing can give you a better copy than the stream it started from.
      </p>
      <p>
        What the higher bitrate actually buys you is headroom. The second encode is generous enough that it does not
        add damage of its own on top of the first. Drop to 128 kbps and you are squeezing an already-squeezed signal,
        which is exactly where audible artifacts come from. So: 320 for anything you plan to keep or edit, 192 if you
        need a smaller file and can live with it, 128 only when file size matters more than sound. If you see a site
        advertising 320 kbps as &ldquo;original quality&rdquo; or &ldquo;lossless,&rdquo; it is talking about the
        container, not the music.
      </p>

      <h2>MP3, WAV, MP4 &mdash; and the quiet best option</h2>
      <p>
        MP3 is the everyday answer. Every phone, car stereo, DJ app, and editor opens it, and at 320 kbps the size is
        reasonable. WAV is uncompressed PCM, which does not undo the lossy compression that already happened &mdash;
        you get a much larger file holding the same audio. Pick it when the file is heading into an editor and you
        would rather not stack a second lossy encode on the way in. MP4 keeps the picture as well as the sound, at
        1080p, 720p, or 480p, which is what you want for a clip rather than a song.
      </p>
      <p>
        There is also OPUS, and it is the technically cleanest choice. Most of these platforms already serve Opus
        audio, so this option copies that stream across without re-encoding it at all. Nothing is added and nothing
        is thrown away. The catch is compatibility: plenty of players and DAWs will not open a .opus file. M4A sits
        between the two.
      </p>

      <h2>Titles and cover art come with it</h2>
      <p>
        Every format except WAV comes out tagged. The title and artist are written into the file&rsquo;s metadata and
        the source thumbnail is embedded as cover art, so it shows up in your music app as a track with a picture
        rather than a row of untitled files. WAV is the exception and not by choice &mdash; PCM WAV has nowhere to put
        a cover image.
      </p>

      <h2>Grabbing only part of it</h2>
      <p>
        Tick &ldquo;download only a section&rdquo; and enter a start and end time (either 1:30 or plain seconds) and
        the server fetches just that range instead of the whole thing. It is quicker, and for a long mix or a set
        recording it saves waiting on audio you were going to discard. If you want to hear where the cut lands before
        committing, download the full track and use the <Link href="/mp3-cutter">MP3 cutter</Link> instead &mdash;
        that runs in your browser, shows you the waveform, and adds fades.
      </p>

      <h2>Where the line is</h2>
      <p>
        Personal use. That means your own uploads, material you are licensed to use, or a recording you already own a
        copy of. Most platforms&rsquo; terms of service address downloading directly, and those terms are the thing
        to read rather than a converter&rsquo;s marketing copy. This page is not legal advice, and it cannot tell you
        your particular situation is fine, because that depends on the material and on where you are.
      </p>
      <p>
        What can be said plainly: if you redistribute, re-upload, or monetize somebody else&rsquo;s recording, that
        is your responsibility, not the tool&rsquo;s. The full policy is on the{" "}
        <Link href="/copyright">copyright page</Link>.
      </p>

      <p>
        Related: <Link href="/guides/how-to-make-a-ringtone">How to make a ringtone from any song</Link> ·{" "}
        <Link href="/guides/find-key-and-bpm-of-any-song">How to find the key and BPM of any song</Link> ·{" "}
        <Link href="/guides">All guides</Link>
      </p>
    </GuideShell>
  );
}
