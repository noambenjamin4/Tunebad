import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guides/GuideShell";
import { howToJsonLd, jsonLdString } from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/site";

const TITLE = "How to Compress a Video for Discord";
const DESCRIPTION =
  "What Discord's upload limit actually is, why it applies per file, the two settings that decide file size, and how to get a clip under the cap in your browser.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/how-to-compress-a-video-for-discord" },
  openGraph: { images: [{ url: "/og/compress-video-discord.png", width: 1200, height: 630 }] },
};

const HOW_TO = howToJsonLd({
  name: TITLE,
  description: DESCRIPTION,
  toolName: "TuneBad video compressor",
  url: `${SITE_URL}/guides/how-to-compress-a-video-for-discord`,
  steps: [
    "Trim the clip down to only the part you need before compressing anything.",
    "Open the TuneBad Discord compressor and pick a target size: 10 MB for a free account, 25 or 50 MB on Nitro.",
    "Drop the video in. It is compressed in the browser and never uploaded.",
    "Wait for the encode to finish; the download starts on its own when it does.",
    "Check the reported before and after sizes, then attach the new MP4 in Discord.",
  ],
});

export default function Page() {
  return (
    <GuideShell
      title={TITLE}
      description={DESCRIPTION}
      path="/guides/how-to-compress-a-video-for-discord"
      datePublished="2026-07-30"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(HOW_TO) }} />
      <h1 className="legal-title">{TITLE}</h1>
      <p className="legal-updated">Updated 2026-07-30</p>

      <p>
        Discord refuses an oversized attachment before it uploads anything, so there is nothing to wait for and
        nothing to retry. The file has to get smaller, get shorter, get split, or get hosted somewhere else and
        linked. This is about making it smaller, and about the cases where smaller is not going to work.
      </p>

      <h2>What the limit actually is</h2>
      <p>
        At the time of writing, a free account can attach about 10 MB per file. Nitro Basic raises that to roughly
        50 MB and full Nitro to roughly 500 MB, and a boosted server can lift the cap for everyone posting in it.
        Treat all of those as current rather than permanent. Discord has moved the free limit before — it used to be
        8 MB — and can move it again without telling anyone. The reliable check is your own client: try the upload
        and see whether it is refused. It costs nothing, because a refused file is never sent.
      </p>

      <h2>The limit is per file</h2>
      <p>
        Each attachment is measured on its own, not added up across the message. Ten attachments of 9 MB are fine;
        one attachment of 11 MB is not. That makes splitting a legitimate fix and often a better one than
        compressing harder — two halves at 10 MB each carry twice the bitrate of one whole clip at 10 MB, so both
        halves look twice as good as the single file would have.
      </p>

      <h2>The two levers that matter</h2>
      <p>
        File size is bitrate multiplied by duration. Nothing else is in the equation. Resolution and frame rate
        matter only because they decide how much bitrate you need before the picture starts falling apart.
      </p>
      <p>
        Ten megabytes is around 80,000 kilobits of total budget. Divide it by the length in seconds to see what you
        are working with:
      </p>
      <ul>
        <li>
          <strong>30 seconds</strong> — about 2,700 kbps. 1080p still looks fine.
        </li>
        <li>
          <strong>1 minute</strong> — about 1,300 kbps. Comfortable at 720p.
        </li>
        <li>
          <strong>2 minutes</strong> — about 680 kbps. 720p, visibly softer in motion.
        </li>
        <li>
          <strong>5 minutes</strong> — about 270 kbps. Bad at any resolution.
        </li>
      </ul>
      <p>
        Audio takes a slice of that. TuneBad reserves 96 kbps for it, which is a rounding error on a 30-second clip
        and a real bite out of a five-minute one. Length is the multiplier on everything: double the duration and
        you halve the bitrate.
      </p>

      <h2>Trim before you compress</h2>
      <p>
        Cutting 20 seconds off a 60-second clip gives the remaining 40 seconds 50% more bitrate. No encoder setting
        buys you that much. The dead air before the thing you wanted to show, the fumbling at the end, the ten
        seconds of loading screen — that is usually where the file size is.
      </p>
      <p>
        The compressor here does not trim, and pretending otherwise would waste your time. Cut the clip in whatever
        recorded it — Photos on a phone, QuickTime on a Mac, your capture tool&apos;s own editor — and bring the
        short version over.
      </p>

      <h2>Compress it in the browser</h2>
      <p>
        Open <Link href="/compress-video-for-discord">Compress Video for Discord</Link>. Pick 10 MB for a free
        account, or 25 and 50 MB if you have Nitro, and drop the file in. It accepts MP4, MOV, WebM, MKV, AVI and
        M4V up to 500 MB.
      </p>
      <p>Two things worth knowing before you start:</p>
      <ul>
        <li>
          <strong>It is genuinely local.</strong> The encoder is ffmpeg compiled to WebAssembly and it runs in the
          tab. The video is never uploaded, which also means there is a one-time engine download of about 31 MB the
          first time you use it.
        </li>
        <li>
          <strong>It is slower than a desktop encoder.</strong> The build is single-threaded, so it uses one core no
          matter how many you have. A short clip takes seconds. A long one takes minutes. Leave the tab open.
        </li>
      </ul>
      <p>
        The output is H.264 in an MP4 at 30 fps, capped at 720p for a 10 MB target and 1080p for 25 MB and above,
        with AAC audio. If the first pass lands over target, it re-encodes once at a tighter bitrate on its own. The
        download starts automatically, and the before and after sizes are shown so you can confirm you are actually
        under the cap.
      </p>
      <p>
        For anything that is not Discord — a 100 MB email attachment, an upload form with its own limit — the plain{" "}
        <Link href="/compress-video">video compressor</Link> is the same engine with 10, 25, 50 and 100 MB presets.
        WhatsApp has a different and lower cap, handled on{" "}
        <Link href="/compress-video-for-whatsapp">its own page</Link>.
      </p>

      <h2>When it will not work</h2>
      <p>
        A five-minute 4K clip cannot be made to look good at 10 MB. This is not a limitation of this tool; it is
        arithmetic. At roughly 270 kbps you get smearing in every pan and blocking in every fast cut, whatever
        encoder you use. Your real options are to trim it, split it into two or three attachments, use a paid tier,
        or upload it somewhere else and post a link.
      </p>
      <p>
        Screen recordings of text are the other hard case. Low bitrate turns small type to mush faster than it ruins
        a face. Drop the resolution rather than fighting for the bitrate: readable 720p beats blurry 1080p at the
        same size.
      </p>
      <p>
        Very long or very large files can also exhaust the browser&apos;s memory. Everything has to fit in one tab,
        so the tool warns above 300 MB on iPhone and refuses anything over 500 MB. If an encode dies partway, trim
        the source and try again rather than retrying the same file.
      </p>

      <h2>If the size is fine but Discord still will not play it</h2>
      <p>
        That is a container problem, not a size problem. MKV and AVI often upload but do not preview inline.
        Converting to MP4 with the <Link href="/video-converter">video converter</Link> fixes it. Anything that goes
        through the compressor comes out as MP4 already, so the two problems rarely overlap.
      </p>

      <p>
        More: <Link href="/guides">all guides</Link> ·{" "}
        <Link href="/guides/how-to-make-a-ringtone">How to make a ringtone</Link> ·{" "}
        <Link href="/guides/how-to-make-a-beat-switch">How to make a beat switch</Link>
      </p>
    </GuideShell>
  );
}
